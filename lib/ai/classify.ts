import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getModelForUser } from "./registry";
import type { InboxMessage } from "@/lib/gmail";

export type Priority = "urgent" | "normal" | "low";
export type Category = "important" | "newsletter" | "social" | "notification" | "other";

const CATEGORIES: Category[] = ["important", "newsletter", "social", "notification", "other"];

const PrioritySchema = z.object({
  priority: z.enum(["urgent", "normal", "low"]),
  reason: z.string().max(140),
  category: z.enum(["important", "newsletter", "social", "notification", "other"]),
});

const SYSTEM = `You triage a user's email inbox. Given a single email's sender, subject, and a body excerpt, return how much it needs attention AND which bundle it belongs to.

priority — how much it needs the user's attention:
- "urgent": time-sensitive, needs a reply or action soon, from a real person or important system (e.g. a meeting request, a direct question, a deadline, a security alert).
- "normal": legitimate mail worth reading but not pressing (updates, threads the user is on, receipts they may want).
- "low": newsletters, marketing, automated notifications, social, or anything safely ignorable.
Be conservative with "urgent" — reserve it for mail that genuinely can't wait.

category — which bundle:
- "important": real human correspondence or anything genuinely needing the user (questions, meetings, deadlines, receipts that matter).
- "newsletter": marketing, digests, promotions, mailing lists.
- "social": social networks, communities, follow/like/mention notifications.
- "notification": automated/transactional alerts from apps & services (no-reply senders, system messages).
- "other": doesn't clearly fit the above.

Give a short reason (under ~12 words).`;

/**
 * Cheap header/sender heuristic so obvious bulk mail skips the LLM entirely.
 * Returns null for ambiguous mail (→ defer to the model). Confident matches
 * are always low-attention, so we pair them with priority "low".
 */
export function heuristicMeta(
  m: Pick<InboxMessage, "from" | "labelIds" | "hasListUnsubscribe">,
): { category: Category; priority: Priority } | null {
  const from = (m.from || "").toLowerCase();
  const labels = m.labelIds ?? [];
  if (labels.includes("CATEGORY_SOCIAL")) return { category: "social", priority: "low" };
  if (m.hasListUnsubscribe || labels.includes("CATEGORY_PROMOTIONS")) {
    return { category: "newsletter", priority: "low" };
  }
  if (labels.includes("CATEGORY_FORUMS")) return { category: "notification", priority: "low" };
  if (/no-?reply|do-?not-?reply|notification|automated|mailer-daemon/.test(from)) {
    return { category: "notification", priority: "low" };
  }
  return null;
}

/** Best display category for a message: stored value, else heuristic, else "other". */
export function displayCategory(
  m: Pick<InboxMessage, "from" | "labelIds" | "hasListUnsubscribe">,
  stored: string | null | undefined,
): Category {
  if (stored && (CATEGORIES as string[]).includes(stored)) return stored as Category;
  return heuristicMeta(m)?.category ?? "other";
}

function excerpt(m: InboxMessage): string {
  const subject = m.subject || "(no subject)";
  const from = m.from || "(unknown sender)";
  const body = (m.snippet || "").slice(0, 1000);
  return `From: ${from}\nSubject: ${subject}\n\n${body}`;
}

/**
 * Classify a batch of messages for a user and persist results in EmailMeta.
 * Skips messages already classified. Best-effort: a failure on one message
 * (or a missing model) never throws to the caller — it just classifies fewer.
 * Returns the number of newly-classified messages.
 */
export async function classifyMessages(
  userId: string,
  messages: InboxMessage[],
  opts: { limit?: number } = {},
): Promise<number> {
  const limit = opts.limit ?? 15;
  const withIds = messages.filter((m) => Boolean(m.id));
  if (withIds.length === 0) return 0;

  const existing = await prisma.emailMeta.findMany({
    where: { userId, gmailMessageId: { in: withIds.map((m) => m.id) } },
    select: { gmailMessageId: true },
  });
  const seen = new Set(existing.map((e) => e.gmailMessageId));
  const todo = withIds.filter((m) => !seen.has(m.id)).slice(0, limit);
  if (todo.length === 0) return 0;

  type Row = { id: string; priority: Priority; reason: string | null; category: Category };
  const rows: Row[] = [];

  // Cheap pre-filter: obvious bulk mail is categorized by headers, no LLM call.
  const ambiguous: InboxMessage[] = [];
  for (const m of todo) {
    const h = heuristicMeta(m);
    if (h) rows.push({ id: m.id, priority: h.priority, reason: null, category: h.category });
    else ambiguous.push(m);
  }

  if (ambiguous.length > 0) {
    let cheapModel;
    try {
      ({ cheapModel } = await getModelForUser(userId));
    } catch {
      // No model configured (no BYOK key, no OPENAI_API_KEY) — skip the LLM,
      // but still persist whatever the heuristic produced below.
      cheapModel = null;
    }

    if (cheapModel) {
      const results = await Promise.allSettled(
        ambiguous.map(async (m) => {
          const { object } = await generateObject({
            model: cheapModel,
            schema: PrioritySchema,
            system: SYSTEM,
            prompt: excerpt(m),
          });
          return { id: m.id, ...object } satisfies Row;
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled") rows.push(r.value);
      }
    }
  }

  if (rows.length === 0) return 0;

  await prisma.emailMeta.createMany({
    data: rows.map((r) => ({
      userId,
      gmailMessageId: r.id,
      priority: r.priority,
      reason: r.reason,
      category: r.category,
    })),
    skipDuplicates: true,
  });

  return rows.length;
}

/** Look up stored meta for a set of message ids → map keyed by message id. */
export async function getPriorities(
  userId: string,
  messageIds: string[],
): Promise<Map<string, { priority: Priority; reason: string | null; category: string | null }>> {
  if (messageIds.length === 0) return new Map();
  const rows = await prisma.emailMeta.findMany({
    where: { userId, gmailMessageId: { in: messageIds } },
    select: { gmailMessageId: true, priority: true, reason: true, category: true },
  });
  return new Map(
    rows.map((r) => [
      r.gmailMessageId,
      { priority: r.priority as Priority, reason: r.reason, category: r.category },
    ]),
  );
}
