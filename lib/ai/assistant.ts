import "server-only";

import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { z } from "zod";
import { CorsairHttpTransport } from "@/lib/ai/corsair-mcp";
import {
  requireAppIdentity,
  mailboxContextLine,
  type AppIdentity,
} from "@/lib/identity";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getModelForUser } from "@/lib/ai/registry";
import { getTodayBrief } from "@/lib/ai/brief";
import {
  listInboxMessages,
  getThread,
  extractBodies,
  header,
} from "@/lib/gmail";
import { listEvents, getAvailability } from "@/lib/gcal";

type McpTools = Awaited<ReturnType<Awaited<ReturnType<typeof createMCPClient>>["tools"]>>;
type McpClient = { tools: () => Promise<McpTools>; close?: () => Promise<void> | void };
type Connected = { client: McpClient; tools: McpTools };

const CORSAIR_TENANT_HEADER = "X-Corsair-Tenant-Id";

/**
 * Corsair's hosted MCP doesn't expose per-operation tools — it exposes three
 * generic meta-tools: `list_operations`, `get_schema`, and `run_script` (run JS
 * with a `corsair` handle). `run_script` can therefore execute ANY operation,
 * including `gmail.api.messages.send` / `googlecalendar.api.events.create` — i.e.
 * the agent could silently send mail or create events, bypassing our
 * review-first flow. So instead of filtering tools by name (no name ever
 * matched, which is why this used to be a no-op), we inspect the `run_script`
 * code and refuse any mutating operation. The only way to act stays our local
 * `composeEmail` / `scheduleEvent` tools, which hand the user a screen to
 * confirm. Read ops (list/get/getMany/search/getAvailability) run freely.
 */
const WRITE_OP_RE =
  /\.api\.[a-z]+\.(send|create|insert|update|delete|trash|untrash|modify|batchmodify)\b/i;

/**
 * Wrap the MCP `run_script` tool so it refuses mutating Corsair operations,
 * returning a result that steers the agent to the review-first tools instead of
 * throwing (a thrown error would look like a transient MCP failure). Other MCP
 * tools (`list_operations`, `get_schema`) pass through untouched.
 */
function guardMcpWrites(tools: McpTools): McpTools {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => {
      if (name !== "run_script") return [name, tool];
      const run = tool as unknown as {
        execute: (a: unknown, o: unknown) => Promise<unknown>;
      };
      return [
        name,
        {
          ...tool,
          execute: async (args: unknown, opts: unknown) => {
            const code =
              args && typeof (args as { code?: unknown }).code === "string"
                ? (args as { code: string }).code
                : "";
            if (WRITE_OP_RE.test(code)) {
              return {
                isError: true,
                content: [
                  {
                    type: "text",
                    text:
                      "Refused: this tool is read-only. To send an email, call the composeEmail tool; to create or change a calendar event, call scheduleEvent. Both open a screen the user reviews and confirms before anything is sent.",
                  },
                ],
              };
            }
            return run.execute(args, opts);
          },
        },
      ];
    }),
  ) as McpTools;
}

/* ------------------------------------------------------------------ */
/* Corsair MCP connection (shared by chat + quick-command agent)      */
/* ------------------------------------------------------------------ */

/**
 * Errors that mean "this MCP connection is dead, get a fresh one": an expired
 * streamable-HTTP session ("Session not found", 404), a transport the server
 * rejects, or a flaky 4xx on connect. All are transient — reconnecting recovers.
 */
export function isRetriableMcpError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /session not found|HTTP 4\d\d|does not support|transport/i.test(msg);
}

function mcpTransport(tenantId: string) {
  const cfg = corsairTenant(tenantId).mcp.config();
  const url = new URL(cfg.url);
  if (!url.searchParams.has("tenantId")) url.searchParams.set("tenantId", tenantId);
  const headers: Record<string, string> = { ...(cfg.headers ?? {}) };
  if (!headers[CORSAIR_TENANT_HEADER]) headers[CORSAIR_TENANT_HEADER] = tenantId;
  if (cfg.apiKey && !headers.Authorization) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return { type: "http" as const, url: url.toString(), headers };
}

async function openClient(tenantId: string): Promise<McpClient> {
  const { url, headers } = mcpTransport(tenantId);
  return createMCPClient({
    transport: new CorsairHttpTransport({ url, headers }) as never,
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect to Corsair's hosted MCP server, tolerating its intermittently
 * inconsistent session store: a fresh `initialize` can 404 on the next POST for
 * a few seconds, then work again. We re-initialize with exponential backoff +
 * jitter so a brief transient window is absorbed. We keep this window short
 * (~2s) on purpose: when MCP can't be reached, `loadAssistant` fails over to
 * the direct `tenant.run()` read tools, so it's better to fail fast than make
 * the user wait. Null only if every attempt fails.
 */
async function connectMcp(tenantId: string): Promise<Connected | null> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let client: McpClient | undefined;
    try {
      client = await openClient(tenantId);
      const tools = await client.tools();
      if (attempt > 0) console.info(`assistant: MCP connected after ${attempt + 1} attempts`);
      return { client, tools };
    } catch (err) {
      lastErr = err;
      try {
        await client?.close?.();
      } catch {}
      if (!isRetriableMcpError(err)) break;
      if (attempt < maxAttempts - 1) {
        await sleep(300 * 2 ** attempt + Math.random() * 200);
      }
    }
  }
  console.error(
    "assistant: MCP connect failed",
    lastErr instanceof Error ? lastErr.message : lastErr,
  );
  return null;
}

/**
 * Wrap every tool so a mid-stream session drop transparently reconnects with a
 * fresh client and retries once, instead of killing the whole reply.
 */
function resilientMcpTools(
  tenantId: string,
  clients: McpClient[],
  initial: Connected,
): McpTools {
  let current = initial;
  async function reconnect() {
    const next = await connectMcp(tenantId);
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

/* ------------------------------------------------------------------ */
/* Direct read tools (fallback when Corsair MCP is unreachable)        */
/* ------------------------------------------------------------------ */

/**
 * The same Gmail/Calendar reads the agent would do through MCP `run_script`,
 * but backed by the stateless `tenant.run()` REST path the rest of the app
 * uses (inbox, calendar, daily brief) — no MCP session handshake, so the
 * intermittent "Session not found" window can't bite. We only hand these to the
 * agent when an MCP connection couldn't be established, so MCP stays the primary
 * path; this just keeps the assistant useful during a bad Corsair window
 * instead of dropping all read tools and answering text-only.
 */
function fallbackReadTools(tenantId: string, userId: string) {
  const t = () => corsairTenant(tenantId);
  return {
    searchInbox: tool({
      description:
        "Search or list the user's Gmail. Returns matching messages (sender, subject, snippet, date, id, threadId). Use Gmail search syntax in `query` (e.g. 'from:sam newer_than:7d', 'subject:invoice'), or null to list the inbox.",
      inputSchema: z.object({
        query: z.string().nullable().describe("Gmail search query, or null for the inbox."),
        limit: z.number().nullable().describe("Max messages to return (default 20)."),
      }),
      execute: async ({ query, limit }) => {
        const { ok, messages } = await listInboxMessages(t(), {
          query: query ?? undefined,
          limit: limit ?? 20,
          userId,
        });
        if (!ok) return { error: "Mailbox not connected." };
        return {
          messages: messages.map((m) => ({
            id: m.id,
            threadId: m.threadId,
            from: m.from,
            subject: m.subject,
            snippet: m.snippet,
            date: new Date(m.internalDate).toISOString(),
            unread: m.unread,
          })),
        };
      },
    }),
    readThread: tool({
      description:
        "Read a full Gmail conversation by its threadId (from searchInbox). Returns each message's sender, recipients, subject, date, and plain-text body so you can reply with context.",
      inputSchema: z.object({
        threadId: z.string().describe("The thread id to read."),
      }),
      execute: async ({ threadId }) => {
        const res = await getThread(t(), threadId);
        if (!res.success) return { error: "Could not read thread (mailbox not connected?)." };
        const messages = (res.data.messages ?? []).map((m) => {
          const { text, html } = extractBodies(m.payload);
          return {
            from: header(m.payload, "From"),
            to: header(m.payload, "To"),
            subject: header(m.payload, "Subject"),
            date: header(m.payload, "Date"),
            body: (text || html).slice(0, 4000),
          };
        });
        return { messages };
      },
    }),
    listCalendarEvents: tool({
      description:
        "List the user's Google Calendar events in a time range (summary, start, end, location, attendees). Provide ISO 8601 start/end; defaults to the next 7 days from now.",
      inputSchema: z.object({
        startIso: z.string().nullable().describe("Range start as ISO 8601, or null for now."),
        endIso: z.string().nullable().describe("Range end as ISO 8601, or null for 7 days out."),
      }),
      execute: async ({ startIso, endIso }) => {
        const start = startIso ? new Date(startIso) : new Date();
        const end = endIso ? new Date(endIso) : new Date(start.getTime() + 7 * 86_400_000);
        const { ok, messages } = await listEvents(t(), { rangeStart: start, rangeEnd: end });
        if (!ok) return { error: "Calendar not connected." };
        return {
          events: messages.map((e) => ({
            id: e.id,
            summary: e.summary ?? "(no title)",
            start: e.start?.dateTime ?? e.start?.date,
            end: e.end?.dateTime ?? e.end?.date,
            location: e.location ?? null,
            attendees: (e.attendees ?? []).map((a) => a.email).filter(Boolean),
          })),
        };
      },
    }),
    checkAvailability: tool({
      description:
        "Check the user's free/busy times over an ISO 8601 range, to find an open slot before scheduling. Returns the busy intervals.",
      inputSchema: z.object({
        startIso: z.string().describe("Range start as ISO 8601."),
        endIso: z.string().describe("Range end as ISO 8601."),
      }),
      execute: async ({ startIso, endIso }) => {
        const busy = await getAvailability(t(), new Date(startIso), new Date(endIso));
        return { busy };
      },
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Recipient resolution                                                */
/* ------------------------------------------------------------------ */

/** Parse an email out of a raw "Name <a@b.com>" From header. */
function parseFrom(raw: string): { name: string; email: string } {
  const angled = raw.match(/<([^>]+)>/);
  const email = (angled ? angled[1] : raw).trim();
  const name = angled ? raw.slice(0, raw.indexOf("<")).trim().replace(/^"|"$/g, "") : "";
  return { name: name || email, email: email.toLowerCase() };
}

/**
 * Resolve a recipient the user referred to by name ("Sam") into a real email
 * address from their recent correspondents — the same Gmail-style suggestion
 * source the composer autocomplete uses. Returns the address unchanged if it's
 * already an email, or the best contact match, or the original text if none.
 */
export async function resolveRecipient(userId: string, raw: string): Promise<string> {
  const query = raw.trim();
  if (!query || query.includes("@")) return query;
  try {
    const tenantId = await ensureCorsairTenant(userId);
    const t = corsairTenant(tenantId);
    const { ok, messages } = await listInboxMessages(t, { limit: 100 });
    if (!ok) return query;

    const contacts = new Map<string, string>(); // email -> name
    for (const m of messages) {
      const { name, email } = parseFrom(m.from || "");
      if (email.includes("@") && !contacts.has(email)) contacts.set(email, name.toLowerCase());
    }

    const needle = query.toLowerCase();
    let best: { email: string; score: number } | null = null;
    for (const [email, name] of contacts) {
      const local = email.split("@")[0];
      let score = 0;
      if (name === needle || email === needle) score = 100;
      else if (name.split(/\s+/).some((part) => part === needle)) score = 80;
      else if (name.startsWith(needle)) score = 60;
      else if (name.includes(needle)) score = 40;
      else if (local.includes(needle)) score = 20;
      if (score > 0 && (!best || score > best.score)) best = { email, score };
    }
    return best ? best.email : query;
  } catch {
    return query;
  }
}

/* ------------------------------------------------------------------ */
/* Action tools — the only way the assistant takes a write action.     */
/* Each returns a navigation directive the client uses to redirect the */
/* user to a pre-filled screen they review and confirm.                */
/* ------------------------------------------------------------------ */

export type AgentDirective =
  | { kind: "compose"; url: string; label: string; to: string; subject: string }
  | { kind: "event"; url: string; label: string; summary: string }
  | { kind: "search"; url: string; label: string; query: string };

/** Build `/calendar/new` query params from an ISO start/end (preserving wall-clock). */
function eventUrl(input: {
  summary: string;
  startIso: string;
  endIso?: string | null;
  attendees: string;
  description?: string | null;
  addMeet?: boolean;
}): string {
  const params = new URLSearchParams();
  if (input.summary) params.set("summary", input.summary);
  const date = input.startIso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) params.set("date", date);
  const start = input.startIso.slice(11, 16);
  if (/^\d{2}:\d{2}$/.test(start)) params.set("startTime", start);
  const end = (input.endIso ?? "").slice(11, 16);
  if (/^\d{2}:\d{2}$/.test(end)) params.set("endTime", end);
  if (input.attendees) params.set("attendees", input.attendees);
  if (input.description) params.set("description", input.description);
  if (input.addMeet) params.set("addMeet", "1");
  return `/calendar/new?${params.toString()}`;
}

function actionTools(userId: string, onDirective?: (d: AgentDirective) => void) {
  const capture = <D extends AgentDirective>(d: D): D => {
    onDirective?.(d);
    return d;
  };
  return {
    composeEmail: tool({
      description:
        "Open a pre-filled email compose screen for the user to review and send. Use this for ANY request to write, draft, reply to, or send an email. Write the COMPLETE email yourself (greeting, message, sign-off) — do not leave placeholders. This does NOT send; the user reviews and clicks Send.",
      inputSchema: z.object({
        to: z
          .string()
          .describe("Recipient — an email address, or the person's name (it will be resolved to an address from recent contacts)."),
        subject: z.string().describe("Email subject line."),
        body: z
          .string()
          .describe(
            "The full, ready-to-send email body. For format 'plain' use plain text. For format 'html' use an inline-styled HTML fragment (paragraphs in <p>, lists in <ul>/<li>, links in <a>, emphasis in <strong>/<em>) — inline style attributes only, no <html>/<head>/<body> wrapper; it is placed inside a branded card.",
          ),
        format: z
          .enum(["plain", "html"])
          .describe(
            "Whether the body is plain text or styled HTML. Default to 'plain' for short/casual notes. Use 'html' when the user asks for a professional, formatted, designed, or branded-looking email. If the user hasn't said and a styled email might be wanted, briefly ask them which they prefer before calling this.",
          ),
      }),
      execute: async ({ to, subject, body, format }) => {
        const resolved = await resolveRecipient(userId, to);
        const params = new URLSearchParams();
        if (resolved) params.set("to", resolved);
        if (subject) params.set("subject", subject);
        if (body) params.set("body", body);
        if (format === "html") params.set("html", "1");
        return capture({
          kind: "compose",
          url: `/mail/compose?${params.toString()}`,
          label: `Email ${resolved || to || "recipient"}`,
          to: resolved,
          subject,
        });
      },
    }),
    scheduleEvent: tool({
      description:
        "Open a pre-filled new-event screen for the user to review and create. Use this for ANY request to schedule, book, or create a calendar event/meeting. This does NOT create the event; the user reviews and clicks Create.",
      inputSchema: z.object({
        summary: z.string().describe("Event title."),
        startIso: z
          .string()
          .describe("Event start as a full ISO 8601 datetime with offset. Resolve relative dates against the current time."),
        endIso: z
          .string()
          .nullable()
          .describe("Event end as ISO 8601. Default to one hour after start if no duration is given."),
        attendees: z
          .array(z.string())
          .describe("Guest emails or names (names are resolved to addresses). [] if none."),
        description: z.string().nullable().describe("Optional event description / agenda."),
        addMeet: z
          .boolean()
          .describe(
            "Whether to attach a Google Meet video-conferencing link. Set true when the user mentions Google Meet, a video/online/virtual call, or a remote meeting. Default false for in-person or unspecified events.",
          ),
      }),
      execute: async ({ summary, startIso, endIso, attendees, description, addMeet }) => {
        const resolved = await Promise.all(
          (attendees ?? []).map((a) => resolveRecipient(userId, a)),
        );
        return capture({
          kind: "event",
          url: eventUrl({
            summary,
            startIso,
            endIso,
            attendees: resolved.filter(Boolean).join(", "),
            description,
            addMeet,
          }),
          label: `Schedule “${summary}”`,
          summary,
        });
      },
    }),
    searchMail: tool({
      description:
        "Take the user to their mailbox filtered by a search query. Use when they want to find or browse emails matching terms.",
      inputSchema: z.object({
        query: z.string().describe("Gmail-style search terms."),
      }),
      execute: async ({ query }) =>
        capture({
          kind: "search",
          url: `/mail?q=${encodeURIComponent(query)}`,
          label: `Search “${query}”`,
          query,
        }),
    }),
  };
}

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

type Brief = Awaited<ReturnType<typeof getTodayBrief>>;

function buildSystem(
  identity: AppIdentity,
  opts: { connected: boolean; brief: Brief; quickCommand: boolean },
): string {
  const now = new Date();
  return [
    "You are ZenScail, an assistant that manages the user's Gmail and Google Calendar.",
    `Current date and time: ${now.toISOString()} (${now.toUTCString()}).`,
    mailboxContextLine(identity),
    "Resolve relative dates ('next Thursday', 'tomorrow at 9') against the current date above. If a timezone matters and is ambiguous, ask.",
    "",
    "SCOPE — you ONLY help with the user's email and calendar: reading, searching, summarizing, drafting/replying/sending mail, and finding or scheduling events. That is the full extent of what you do. Talking through these tasks (deciding what to write, who to contact, when to meet) is in scope. Anything outside it is NOT — e.g. writing or debugging code, building apps or products, doing math or counting, general knowledge or research, creative writing unrelated to an email, or any other task that is not about the user's mail or calendar. When a request falls outside this scope, do not attempt it, do not call any tool, and do not explain how it could be done. Reply with exactly this and nothing else: \"I'm designed by *ZenScail* to manage your email and calendar. I don't have permission to do things outside that scope.\"",
    "",
    "HOW YOU TAKE ACTION — you never send mail or create events directly. Instead you prepare them for the user to review:",
    "• To write, draft, reply to, or send an email → call `composeEmail` with the recipient and the COMPLETE subject and body. It opens a pre-filled compose screen the user reviews and sends. Choose `format`: 'plain' for ordinary notes, 'html' (inline-styled) for professional/designed emails. If the user might want a styled email and hasn't said, ask whether they'd like plain text or a styled HTML email before drafting.",
    "• To schedule, book, or create a calendar event → call `scheduleEvent`. It opens a pre-filled new-event screen the user reviews and creates.",
    "• To find or browse mail → answer from the read tools, or call `searchMail` to take them to filtered results.",
    "Before drafting, USE the read tools to look up the right person's email address, find the email/thread being referred to, or check the calendar for free time. Write complete, well-judged drafts — do not leave blanks or placeholders.",
    ...(opts.quickCommand
      ? [
          "",
          "The user issued a single command from the quick bar. Carry it out end-to-end and FINISH by calling `composeEmail`, `scheduleEvent`, or `searchMail`. Only reply with plain text if the request is a question, or if you genuinely need a clarification you cannot resolve from their mailbox.",
        ]
      : [
          "Before sending or creating, state briefly what you're about to do. Keep replies short and practical; format in markdown.",
        ]),
    ...(opts.connected
      ? []
      : [
          "NOTE: Your Gmail/Calendar read tools are temporarily unavailable. Do not claim to read anything from the inbox; you can still draft from what the user tells you.",
        ]),
    ...(opts.brief
      ? [
          "",
          "TODAY'S DAILY BRIEF (already shown on the dashboard — use it to answer about their day or act on items):",
          `Headline: ${opts.brief.headline}`,
          opts.brief.overview,
          opts.brief.actionItems.length
            ? `Action items:\n${opts.brief.actionItems
                .map(
                  (a) =>
                    `- [${a.urgency}] ${a.title} — ${a.detail}${
                      a.subject ? ` (email: "${a.subject}" from ${a.from})` : ""
                    }`,
                )
                .join("\n")}`
            : "Action items: none",
          opts.brief.events.length
            ? `Today's events:\n${opts.brief.events
                .map((e) => `- ${e.summary} (${e.allDay ? "all day" : e.start})`)
                .join("\n")}`
            : "Today's events: none",
        ]
      : []),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type LoadedAssistant = {
  userId: string;
  model: LanguageModel;
  system: string;
  tools: Record<string, unknown>;
  connected: boolean;
  closeAll: () => Promise<void>;
};

/**
 * Resolve the full agent setup shared by the chat dock and the quick-command
 * bar: the user's model, the system prompt, and the toolset (Corsair read tools
 * + our review-first action tools). Call `closeAll()` when the run ends.
 */
export async function loadAssistant(opts: {
  overrideModel?: string;
  quickCommand?: boolean;
  onDirective?: (d: AgentDirective) => void;
}): Promise<LoadedAssistant> {
  const { session, identity } = await requireAppIdentity();
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);

  const [{ model }, brief] = await Promise.all([
    getModelForUser(userId, opts.overrideModel),
    getTodayBrief(userId).catch(() => null),
  ]);

  // MCP-first: use Corsair's hosted MCP (the high-value bonus path) for the
  // agent's Gmail/Calendar reads. If it can't be reached after a short retry
  // window — Corsair's session store is intermittently inconsistent — fail over
  // to the direct `tenant.run()` read tools so the assistant stays useful.
  const clients: McpClient[] = [];
  const connected = await connectMcp(tenantId);
  let readTools: Record<string, unknown>;
  if (connected) {
    clients.push(connected.client);
    // Keep all MCP tools, but guard `run_script` so writes can't bypass review.
    readTools = guardMcpWrites(resilientMcpTools(tenantId, clients, connected));
    console.info("assistant: using Corsair MCP read tools");
  } else {
    readTools = fallbackReadTools(tenantId, userId);
    console.warn("assistant: Corsair MCP unreachable — using direct tenant.run() read tools");
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

  // Reads are available either way now (MCP or the direct fallback), so the
  // agent always has Gmail/Calendar read tools — `connected` reflects that.
  const hasReadTools = Object.keys(readTools).length > 0;

  return {
    userId,
    model,
    system: buildSystem(identity, {
      connected: hasReadTools,
      brief,
      quickCommand: Boolean(opts.quickCommand),
    }),
    tools: { ...readTools, ...actionTools(userId, opts.onDirective) },
    connected: hasReadTools,
    closeAll,
  };
}

/**
 * Run a single natural-language command to completion (non-streaming), the way
 * the quick-add bar uses the agent. Returns the navigation directive the agent
 * produced (compose / event / search), plus any text it replied with — so the
 * caller can redirect, or fall back to opening the chat dock for a conversation.
 */
export async function runAgentCommand(
  text: string,
  overrideModel?: string,
): Promise<{ directive: AgentDirective | null; text: string }> {
  let captured: AgentDirective | null = null;
  const assistant = await loadAssistant({
    overrideModel,
    quickCommand: true,
    onDirective: (d) => {
      captured = d;
    },
  });
  try {
    const result = await generateText({
      model: assistant.model,
      system: assistant.system,
      tools: assistant.tools as Parameters<typeof generateText>[0]["tools"],
      stopWhen: stepCountIs(8),
      prompt: text,
    });
    return { directive: captured, text: result.text };
  } finally {
    await assistant.closeAll();
  }
}
