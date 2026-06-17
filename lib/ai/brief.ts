import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { ensureCorsairTenant } from "@/lib/tenant";
import { listInboxMessages, type InboxMessage } from "@/lib/gmail";
import { listEvents, isAllDay, type CachedEvent } from "@/lib/gcal";
import { listSurfacedFollowUps } from "@/lib/followUp";
import { getModelForUser } from "./registry";

// --- Shapes stored in DailyBrief's Json columns ---

export type BriefActionItem = {
  title: string;
  detail: string;
  urgency: "high" | "medium" | "low";
  /** Gmail ids so the UI can deep-link to the full email. */
  messageId?: string;
  threadId?: string;
  from?: string;
  subject?: string;
};

export type BriefEvent = {
  id: string;
  summary: string;
  start: string; // ISO or "YYYY-MM-DD" for all-day
  end: string;
  allDay: boolean;
  location?: string;
  hangoutLink?: string;
  attendeeCount: number;
};

export type BriefStats = {
  emailsReviewed: number;
  urgentCount: number;
  meetingsToday: number;
};

/** Per-item interaction state, keyed by the item's stable key (see itemKey). */
export type BriefItemState = { status: "done" | "snoozed"; until?: string };
export type BriefItemStates = Record<string, BriefItemState>;

export type Brief = {
  date: string;
  headline: string;
  overview: string;
  actionItems: BriefActionItem[];
  events: BriefEvent[];
  stats: BriefStats;
  itemStates: BriefItemStates;
  createdAt: Date;
};

/**
 * A stable, content-derived key for an action item so its done/snoozed state
 * survives across re-renders (and index shifts within a stored brief).
 */
export function itemKey(item: BriefActionItem): string {
  return [item.threadId ?? "", item.title].join("|");
}

const BriefSchema = z.object({
  headline: z
    .string()
    .max(120)
    .describe("One warm, specific sentence capturing the shape of the user's day."),
  overview: z
    .string()
    .describe(
      "2-4 short markdown paragraphs summarizing what came in yesterday and what today looks like. May use **bold** for emphasis. No headings, no lists (action items are separate).",
    ),
  actionItems: z
    .array(
      z.object({
        title: z.string().max(80).describe("Short imperative, e.g. 'Reply to Sarah about the contract'"),
        detail: z.string().max(200).describe("One sentence of context: who, what, why it matters today."),
        urgency: z.enum(["high", "medium", "low"]),
        emailIndex: z
          .number()
          .int()
          .nullable()
          .describe("Index of the source email in the provided list, or null if not email-derived."),
      }),
    )
    .max(8)
    .describe("Concrete to-dos for today, most urgent first. Only include genuinely actionable items."),
});

function fmtEmail(m: InboxMessage, i: number, priority?: string): string {
  return [
    `[${i}] From: ${m.from || "(unknown)"}`,
    `    Subject: ${m.subject || "(no subject)"}`,
    priority ? `    Priority: ${priority}` : null,
    `    Snippet: ${(m.snippet || "").slice(0, 300)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtEvent(e: BriefEvent): string {
  const when = e.allDay
    ? "all day"
    : `${new Date(e.start).toISOString()} → ${new Date(e.end).toISOString()}`;
  return `- "${e.summary}" (${when})${e.location ? ` at ${e.location}` : ""}${
    e.attendeeCount > 1 ? `, ${e.attendeeCount} attendees` : ""
  }`;
}

function toBriefEvent(e: CachedEvent): BriefEvent {
  return {
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: isAllDay(e),
    location: e.location || undefined,
    hangoutLink: e.hangoutLink || undefined,
    attendeeCount: e.attendees?.length ?? 0,
  };
}

/** Local-date key, e.g. "2026-06-12". */
export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generate (or regenerate) today's brief for a user: pulls the last day of
 * inbox mail and today's calendar, asks the LLM for a structured summary,
 * and upserts the result into DailyBrief. Throws on failure — callers decide
 * whether that's fatal (cron logs and moves on; the dashboard shows an error).
 */
export async function generateDailyBrief(userId: string): Promise<Brief> {
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [mail, cal] = await Promise.all([
    listInboxMessages(t, { query: "in:inbox newer_than:1d", limit: 30 }),
    listEvents(t, { rangeStart: dayStart, rangeEnd: dayEnd, limit: 25 }),
  ]);
  if (!mail.ok) throw new Error("Gmail not connected");
  const emails = mail.messages;
  const events = (cal.ok ? cal.messages : [])
    .map(toBriefEvent)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const priorities = await prisma.emailMeta.findMany({
    where: { userId, gmailMessageId: { in: emails.map((m) => m.id) } },
    select: { gmailMessageId: true, priority: true },
  });
  const prioById = new Map(priorities.map((p) => [p.gmailMessageId, p.priority]));

  const { model } = await getModelForUser(userId);
  const now = new Date();

  const { object } = await generateObject({
    model,
    schema: BriefSchema,
    system: [
      "You are ZenScail's morning-brief writer. You turn yesterday's inbox and today's calendar into a calm, useful daily brief.",
      "Write in second person ('you'), warm but efficient — like a great chief of staff. Never invent emails or events that aren't in the data.",
      "If the inbox is quiet or the calendar is empty, say so plainly and keep the brief short.",
    ].join("\n"),
    prompt: [
      `Current date and time: ${now.toISOString()} (${now.toDateString()}).`,
      "",
      `EMAILS from the last 24 hours (${emails.length}):`,
      emails.length
        ? emails.map((m, i) => fmtEmail(m, i, prioById.get(m.id))).join("\n")
        : "(none)",
      "",
      `TODAY'S CALENDAR (${events.length} events):`,
      events.length ? events.map(fmtEvent).join("\n") : "(no events)",
    ].join("\n"),
  });

  // Threads waiting on a reply are surfaced as high-urgency action items,
  // deterministically (no extra tokens, always included) and ahead of the
  // LLM's items so they lead the brief.
  const followUps = await listSurfacedFollowUps(userId).catch(() => []);
  const followUpItems: BriefActionItem[] = followUps.map((f) => ({
    title: `Follow up: ${f.subject ?? "(no subject)"}`,
    detail: `No reply${f.contact ? ` from ${f.contact}` : ""} yet — send a nudge?`,
    urgency: "high" as const,
    threadId: f.threadId,
    subject: f.subject ?? undefined,
  }));

  const llmActionItems: BriefActionItem[] = object.actionItems.map((a) => {
    const src =
      a.emailIndex != null && a.emailIndex >= 0 && a.emailIndex < emails.length
        ? emails[a.emailIndex]
        : undefined;
    return {
      title: a.title,
      detail: a.detail,
      urgency: a.urgency,
      messageId: src?.id,
      threadId: src?.threadId || undefined,
      from: src?.from,
      subject: src?.subject,
    };
  });

  const actionItems: BriefActionItem[] = [...followUpItems, ...llmActionItems];

  const stats: BriefStats = {
    emailsReviewed: emails.length,
    urgentCount: priorities.filter((p) => p.priority === "urgent").length,
    meetingsToday: events.length,
  };

  const date = dateKey(now);
  const row = await prisma.dailyBrief.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      headline: object.headline,
      overview: object.overview,
      actionItems,
      events,
      stats,
      itemStates: {},
    },
    // Regenerating produces a fresh item set, so clear any prior done/snoozed marks.
    update: {
      headline: object.headline,
      overview: object.overview,
      actionItems,
      events,
      stats,
      itemStates: {},
    },
  });

  return {
    date,
    headline: row.headline,
    overview: row.overview,
    actionItems,
    events,
    stats,
    itemStates: {},
    createdAt: row.createdAt,
  };
}

/** Today's stored brief for a user, or null if not generated yet. */
export async function getTodayBrief(userId: string): Promise<Brief | null> {
  const row = await prisma.dailyBrief.findUnique({
    where: { userId_date: { userId, date: dateKey() } },
  });
  if (!row) return null;
  return {
    date: row.date,
    headline: row.headline,
    overview: row.overview,
    actionItems: row.actionItems as BriefActionItem[],
    events: row.events as BriefEvent[],
    stats: row.stats as BriefStats,
    itemStates: (row.itemStates as BriefItemStates | null) ?? {},
    createdAt: row.createdAt,
  };
}

/**
 * Merge a single action item's interaction state (done / snoozed) into today's
 * stored brief. No-op if there's no brief yet. Returns the updated map.
 */
export async function setBriefItemState(
  userId: string,
  key: string,
  state: BriefItemState | null,
): Promise<BriefItemStates> {
  const row = await prisma.dailyBrief.findUnique({
    where: { userId_date: { userId, date: dateKey() } },
    select: { itemStates: true },
  });
  if (!row) return {};
  const states = ((row.itemStates as BriefItemStates | null) ?? {}) as BriefItemStates;
  if (state === null) {
    delete states[key];
  } else {
    states[key] = state;
  }
  await prisma.dailyBrief.update({
    where: { userId_date: { userId, date: dateKey() } },
    data: { itemStates: states },
  });
  return states;
}
