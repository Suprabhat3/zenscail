import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getModelForUser } from "./registry";
import type { InboxMessage } from "@/lib/gmail";

export type Priority = "urgent" | "normal" | "low";

const PrioritySchema = z.object({
  priority: z.enum(["urgent", "normal", "low"]),
  reason: z.string().max(140),
});

const SYSTEM = `You triage a user's email inbox. Given a single email's sender, subject, and a body excerpt, classify how much it needs the user's attention:
- "urgent": time-sensitive, needs a reply or action soon, from a real person or important system (e.g. a meeting request, a direct question, a deadline, a security alert).
- "normal": legitimate mail worth reading but not pressing (updates, threads the user is on, receipts they may want).
- "low": newsletters, marketing, automated notifications, social, or anything safely ignorable.
Be conservative with "urgent" — reserve it for mail that genuinely can't wait. Give a short reason (under ~12 words).`;

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

  let cheapModel;
  try {
    ({ cheapModel } = await getModelForUser(userId));
  } catch {
    // No model configured (no BYOK key, no OPENAI_API_KEY) — skip silently.
    return 0;
  }

  const results = await Promise.allSettled(
    todo.map(async (m) => {
      const { object } = await generateObject({
        model: cheapModel,
        schema: PrioritySchema,
        system: SYSTEM,
        prompt: excerpt(m),
      });
      return { id: m.id, ...object };
    }),
  );

  const rows = results
    .filter(
      (r): r is PromiseFulfilledResult<{ id: string; priority: Priority; reason: string }> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  if (rows.length === 0) return 0;

  await prisma.emailMeta.createMany({
    data: rows.map((r) => ({
      userId,
      gmailMessageId: r.id,
      priority: r.priority,
      reason: r.reason,
    })),
    skipDuplicates: true,
  });

  return rows.length;
}

/** Look up stored priorities for a set of message ids → map keyed by message id. */
export async function getPriorities(
  userId: string,
  messageIds: string[],
): Promise<Map<string, { priority: Priority; reason: string | null }>> {
  if (messageIds.length === 0) return new Map();
  const rows = await prisma.emailMeta.findMany({
    where: { userId, gmailMessageId: { in: messageIds } },
    select: { gmailMessageId: true, priority: true, reason: true },
  });
  return new Map(
    rows.map((r) => [r.gmailMessageId, { priority: r.priority as Priority, reason: r.reason }]),
  );
}
