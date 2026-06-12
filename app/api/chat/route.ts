import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getModelForUser } from "@/lib/ai/registry";
import { getTodayBrief } from "@/lib/ai/brief";

export const maxDuration = 120;

type McpClient = Awaited<
  ReturnType<ReturnType<typeof corsairTenant>["mcp"]["createVercelClient"]>
>;
type McpTools = Awaited<ReturnType<McpClient["tools"]>>;

function isSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /session not found|HTTP 404|HTTP 400/i.test(msg);
}

/**
 * Corsair's hosted MCP server can drop a streamable-HTTP session mid-stream
 * ("Session not found", HTTP 404) — e.g. when a previous request for the same
 * tenant closes. Wrap every tool so a session error transparently reconnects
 * with a fresh client and retries once, instead of killing the whole reply.
 */
function resilientMcpTools(
  tenantId: string,
  clients: McpClient[],
  initial: { client: McpClient; tools: McpTools },
): McpTools {
  let current = initial;

  async function reconnect() {
    const client = await corsairTenant(tenantId).mcp.createVercelClient();
    clients.push(client);
    current = { client, tools: await client.tools() };
  }

  return Object.fromEntries(
    Object.entries(initial.tools).map(([name, tool]) => [
      name,
      {
        ...tool,
        execute: async (args: unknown, opts: unknown) => {
          const run = () =>
            (
              current.tools[name] as {
                execute: (a: unknown, o: unknown) => Promise<unknown>;
              }
            ).execute(args, opts);
          try {
            return await run();
          } catch (err) {
            if (!isSessionError(err)) throw err;
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
  const mcpClient = await corsairTenant(tenantId).mcp.createVercelClient();
  clients.push(mcpClient);
  const tools = resilientMcpTools(tenantId, clients, {
    client: mcpClient,
    tools: await mcpClient.tools(),
  });
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
    `The user's email address is ${session.user.email}; their name is ${session.user.name}.`,
    "Resolve relative dates ('next Thursday', 'tomorrow at 9') against the current date above. If a timezone matters and is ambiguous, ask.",
    "Before sending email or creating/modifying events, state what you're about to do. Report what you actually did, including failures.",
    "Keep replies short and practical. Format responses in markdown (lists, bold, tables where helpful).",
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
