import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { CorsairHttpTransport } from "@/lib/ai/corsair-mcp";
import { requireSession } from "@/lib/session";
import { getAppIdentityForUser, mailboxContextLine } from "@/lib/identity";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getModelForUser } from "@/lib/ai/registry";
import { getTodayBrief } from "@/lib/ai/brief";

export const maxDuration = 120;

type McpTools = Awaited<ReturnType<Awaited<ReturnType<typeof createMCPClient>>["tools"]>>;
// Minimal shape both createMCPClient and the SDK's createVercelClient satisfy.
type McpClient = { tools: () => Promise<McpTools>; close?: () => Promise<void> | void };
type Transport = "http" | "sse";
type Connected = { client: McpClient; tools: McpTools; transport: Transport };

const CORSAIR_TENANT_HEADER = "X-Corsair-Tenant-Id";

/**
 * Errors that mean "this MCP connection is dead, get a fresh one": an expired
 * streamable-HTTP session ("Session not found", 404), a transport the server
 * rejects ("does not support HTTP transport, try sse"), or a flaky 4xx on
 * connect. All are transient — reconnecting (and falling back to SSE) recovers.
 */
function isRetriableMcpError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /session not found|HTTP 4\d\d|does not support|transport/i.test(msg);
}

/** Build a Corsair MCP transport config by hand so we can pick http vs sse. */
function mcpTransport(tenantId: string, type: Transport) {
  const cfg = corsairTenant(tenantId).mcp.config();
  const url = new URL(cfg.url);
  if (!url.searchParams.has("tenantId")) url.searchParams.set("tenantId", tenantId);
  const headers: Record<string, string> = { [CORSAIR_TENANT_HEADER]: tenantId };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return { type, url: url.toString(), headers };
}

/**
 * Connect to Corsair's hosted MCP server, tolerating its flaky sessions.
 * Tries the preferred transport (streamable HTTP) a couple of times, then
 * falls back to SSE — which is exactly what the server's 404 asks for when it
 * can't find an HTTP session. Returns null if every attempt fails so the chat
 * can still answer (just without Gmail/Calendar tools) instead of 500ing.
 */
async function openClient(tenantId: string, transport: Transport): Promise<McpClient> {
  if (transport === "http") {
    // Custom POST-only transport — avoids the SDK's background GET stream that
    // Corsair 404s on (see lib/ai/corsair-mcp.ts).
    const { url, headers } = mcpTransport(tenantId, "http");
    return createMCPClient({
      transport: new CorsairHttpTransport({ url, headers }) as never,
    });
  }
  // SSE fallback, built by hand.
  return createMCPClient({ transport: mcpTransport(tenantId, "sse") });
}

async function connectMcp(
  tenantId: string,
  prefer: Transport = "http",
): Promise<Connected | null> {
  const order: Transport[] = prefer === "http" ? ["http", "sse"] : ["sse", "http"];
  let lastErr: unknown;
  for (const transport of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let client: McpClient | undefined;
      try {
        client = await openClient(tenantId, transport);
        const tools = await client.tools();
        return { client, tools, transport };
      } catch (err) {
        lastErr = err;
        try {
          await client?.close?.();
        } catch {}
        // Non-transient error (or last shot at this transport) → move on.
        if (!isRetriableMcpError(err)) break;
      }
    }
  }
  console.error(
    "chat: MCP connect failed",
    lastErr instanceof Error ? lastErr.message : lastErr,
  );
  return null;
}

/**
 * Wrap every tool so a mid-stream session drop ("Session not found", HTTP 404)
 * transparently reconnects with a fresh client and retries once, instead of
 * killing the whole reply.
 */
function resilientMcpTools(
  tenantId: string,
  clients: McpClient[],
  initial: Connected,
): McpTools {
  let current = initial;

  async function reconnect() {
    const next = await connectMcp(tenantId, current.transport);
    if (!next) throw new Error("MCP reconnect failed");
    clients.push(next.client);
    current = next;
  }

  return Object.fromEntries(
    Object.entries(initial.tools).map(([name, tool]) => [
      name,
      {
        ...tool,
        execute: async (args: unknown, opts: unknown) => {
          const run = () =>
            (
              current.tools[name] as unknown as {
                execute: (a: unknown, o: unknown) => Promise<unknown>;
              }
            ).execute(args, opts);
          try {
            return await run();
          } catch (err) {
            if (!isRetriableMcpError(err)) throw err;
            await reconnect();
            return await run();
          }
        },
      },
    ]),
  ) as McpTools;
}

export async function POST(req: Request) {
  const session = await requireSession();
  const identity = await getAppIdentityForUser(session.user.id, session.user);
  const tenantId = await ensureCorsairTenant(session.user.id);

  const body: { messages: UIMessage[]; model?: string } = await req.json();
  const { messages } = body;
  // Cap conversation length as a cheap rate/abuse guard.
  if (!Array.isArray(messages) || messages.length > 100) {
    return new Response("Bad request", { status: 400 });
  }

  const [{ model }, brief] = await Promise.all([
    getModelForUser(
      session.user.id,
      typeof body.model === "string" ? body.model : undefined,
    ),
    getTodayBrief(session.user.id).catch(() => null),
  ]);
  const clients: McpClient[] = [];
  const connected = await connectMcp(tenantId);
  let tools: McpTools = {} as McpTools;
  if (connected) {
    clients.push(connected.client);
    tools = resilientMcpTools(tenantId, clients, connected);
  } else {
    console.error("chat: MCP unavailable; answering without Gmail/Calendar tools");
  }
  const closeAll = async () => {
    await Promise.all(
      clients.map(async (c) => {
        try {
          await c.close?.();
        } catch {}
      }),
    );
  };

  const now = new Date();
  // Do NOT list Corsair operation names here — the MCP server handles discovery.
  const system = [
    "You are ZenScail, an assistant that manages the user's Gmail and Google Calendar using the tools available to you.",
    `Current date and time: ${now.toISOString()} (${now.toUTCString()}).`,
    mailboxContextLine(identity),
    "Resolve relative dates ('next Thursday', 'tomorrow at 9') against the current date above. If a timezone matters and is ambiguous, ask.",
    "Before sending email or creating/modifying events, state what you're about to do. Report what you actually did, including failures.",
    "Keep replies short and practical. Format responses in markdown (lists, bold, tables where helpful).",
    ...(connected
      ? []
      : [
          "NOTE: Your Gmail/Calendar tools are temporarily unavailable right now. Do not claim to read, send, or change anything. Answer from context only and tell the user to retry in a moment for actions that need their inbox or calendar.",
        ]),
    ...(brief
      ? [
          "",
          "TODAY'S DAILY BRIEF (already shown to the user on their dashboard — use it to answer questions about their day, expand on items, or act on them):",
          `Headline: ${brief.headline}`,
          brief.overview,
          brief.actionItems.length
            ? `Action items:\n${brief.actionItems
                .map(
                  (a) =>
                    `- [${a.urgency}] ${a.title} — ${a.detail}${
                      a.subject ? ` (email: "${a.subject}" from ${a.from})` : ""
                    }`,
                )
                .join("\n")}`
            : "Action items: none",
          brief.events.length
            ? `Today's events:\n${brief.events
                .map((e) => `- ${e.summary} (${e.allDay ? "all day" : e.start})`)
                .join("\n")}`
            : "Today's events: none",
        ]
      : []),
  ].join("\n");

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(15),
    onFinish: closeAll,
    onError: closeAll,
    onAbort: closeAll,
  });

  return result.toUIMessageStreamResponse();
}
