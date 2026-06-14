"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getModelForUser } from "@/lib/ai/registry";
import { createEvent } from "@/lib/gcal";
import { listInboxMessages } from "@/lib/gmail";

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
async function resolveRecipient(userId: string, raw: string): Promise<string> {
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

/**
 * Parsed intent for the natural-language quick-add bar. One LLM call on the
 * cheap tier classifies the text into one of four actions and extracts the
 * fields the client needs to either confirm-and-execute or hand off.
 */
export type QuickAddIntent =
  | {
      kind: "event";
      confirm: string;
      summary: string;
      startIso: string;
      endIso: string;
      attendees: string[];
    }
  | { kind: "email"; confirm: string; to: string; subject: string; body: string }
  | { kind: "search"; confirm: string; query: string }
  | { kind: "agent"; confirm: string; text: string };

const IntentSchema = z.object({
  kind: z
    .enum(["event", "email", "search", "agent"])
    .describe(
      "event: create a calendar event. email: send/compose a message. search: find mail. agent: anything more complex or ambiguous — hand off to the assistant.",
    ),
  confirm: z
    .string()
    .max(140)
    .describe("One short human sentence describing what will happen, e.g. \"Create 'Lunch with Sam' Thu 1–2pm\"."),
  summary: z.string().nullable().describe("Event title (event only)."),
  startIso: z
    .string()
    .nullable()
    .describe("Event start as a full ISO 8601 datetime with offset (event only). Resolve relative dates against the current time."),
  endIso: z
    .string()
    .nullable()
    .describe("Event end ISO 8601 (event only). Default to one hour after start if no duration is given."),
  attendees: z.array(z.string()).describe("Attendee email addresses found in the text (event only; [] if none)."),
  to: z.string().nullable().describe("Recipient email or name (email only)."),
  subject: z.string().nullable().describe("Email subject (email only)."),
  body: z.string().nullable().describe("Email body (email only)."),
  query: z.string().nullable().describe("Search terms (search only)."),
});

export async function quickAdd(text: string): Promise<QuickAddIntent> {
  const trimmed = text.trim();
  const session = await requireSession();
  if (!trimmed) return { kind: "agent", confirm: "Ask the assistant", text: trimmed };

  let parsed: z.infer<typeof IntentSchema>;
  try {
    const { cheapModel } = await getModelForUser(session.user.id);
    const now = new Date();
    const tz = "UTC";
    const { object } = await generateObject({
      model: cheapModel,
      schema: IntentSchema,
      system: [
        "You convert a single line of natural language into one structured action for an email + calendar app.",
        `Current date and time: ${now.toISOString()} (${now.toUTCString()}). Default timezone: ${tz}.`,
        `The user's email is ${session.user.email}; their name is ${session.user.name}.`,
        "Resolve relative dates ('tomorrow 1pm', 'Friday 10am', 'next Thursday') against the current time and emit absolute ISO 8601 datetimes with an offset.",
        "Pick 'event' for scheduling/meetings, 'email' when they want to write/send a message, 'search' for finding mail, and 'agent' for anything multi-step, vague, or that needs back-and-forth.",
        "Only fill fields relevant to the chosen kind; leave the rest null/empty. Never invent attendee emails that aren't present.",
      ].join("\n"),
      prompt: trimmed,
    });
    parsed = object;
  } catch {
    // No model / parse failure → let the full agent handle it.
    return { kind: "agent", confirm: "Ask the assistant", text: trimmed };
  }

  switch (parsed.kind) {
    case "event": {
      const start = parsed.startIso ?? "";
      const startMs = Date.parse(start);
      if (!parsed.summary || Number.isNaN(startMs)) {
        return { kind: "agent", confirm: "Ask the assistant", text: trimmed };
      }
      const endMs = parsed.endIso ? Date.parse(parsed.endIso) : NaN;
      const endIso = Number.isNaN(endMs)
        ? new Date(startMs + 3600_000).toISOString()
        : new Date(endMs).toISOString();
      return {
        kind: "event",
        confirm: parsed.confirm,
        summary: parsed.summary,
        startIso: new Date(startMs).toISOString(),
        endIso,
        attendees: parsed.attendees.filter((a) => a.includes("@")),
      };
    }
    case "email": {
      // Resolve a name ("Sam") to a real address from recent correspondents,
      // so the composer opens with a ready-to-send recipient, not just a name.
      const to = await resolveRecipient(session.user.id, parsed.to ?? "");
      return {
        kind: "email",
        confirm: parsed.confirm,
        to,
        subject: parsed.subject ?? "",
        body: parsed.body ?? "",
      };
    }
    case "search":
      return { kind: "search", confirm: parsed.confirm, query: parsed.query ?? trimmed };
    default:
      return { kind: "agent", confirm: parsed.confirm || "Ask the assistant", text: trimmed };
  }
}

/** Confirm-and-create the event parsed by quickAdd. Returns a result, never redirects. */
export async function createQuickEvent(input: {
  summary: string;
  startIso: string;
  endIso: string;
  attendees: string[];
}): Promise<{ ok: boolean; htmlLink?: string }> {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const start = Date.parse(input.startIso);
  const end = Date.parse(input.endIso);
  if (!input.summary || Number.isNaN(start) || Number.isNaN(end)) {
    return { ok: false };
  }

  const result = await createEvent(t, {
    summary: input.summary,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
    ...(input.attendees.length
      ? { attendees: input.attendees.filter((a) => a.includes("@")).map((email) => ({ email })) }
      : {}),
    reminders: { useDefault: true },
  });
  if (!result.success) return { ok: false };
  revalidatePath("/calendar");
  return { ok: true, htmlLink: result.data.htmlLink };
}
