import "server-only";

import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { ensureCorsairTenant } from "@/lib/tenant";
import { getThread, header } from "@/lib/gmail";
import { publish } from "@/lib/realtime";

export type FollowUpInput = {
  threadId: string;
  lastKnownMessageId: string;
  subject?: string | null;
  contact?: string | null;
  remindAt: Date;
  note?: string | null;
};

/** Arm (or re-arm) a follow-up reminder on a thread. One per thread per user. */
export async function setFollowUp(userId: string, input: FollowUpInput) {
  return prisma.followUp.upsert({
    where: { userId_threadId: { userId, threadId: input.threadId } },
    create: {
      userId,
      threadId: input.threadId,
      lastKnownMessageId: input.lastKnownMessageId,
      subject: input.subject ?? null,
      contact: input.contact ?? null,
      remindAt: input.remindAt,
      note: input.note ?? null,
      status: "waiting",
      surfacedAt: null,
    },
    update: {
      lastKnownMessageId: input.lastKnownMessageId,
      subject: input.subject ?? null,
      contact: input.contact ?? null,
      remindAt: input.remindAt,
      note: input.note ?? null,
      status: "waiting",
      surfacedAt: null,
    },
  });
}

/** Dismiss a follow-up (user handled it manually). */
export async function dismissFollowUp(userId: string, threadId: string) {
  await prisma.followUp.updateMany({
    where: { userId, threadId },
    data: { status: "done" },
  });
}

/** Extract the bare email from a "From" header: `Name <a@b.com>` → `a@b.com`. */
function emailFromHeader(raw: string): string {
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/** The set of email addresses that count as "me" for reply detection. */
function myAddresses(user: { email: string; connectedEmail: string | null }): Set<string> {
  return new Set(
    [user.email, user.connectedEmail]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase()),
  );
}

/**
 * Given a thread's messages and the message id we last saw, decide whether a
 * newer message arrived from someone other than the user (a real reply).
 */
function hasInboundReply(
  messages: { id?: string; payload?: Parameters<typeof header>[0] }[],
  lastKnownMessageId: string,
  mine: Set<string>,
): boolean {
  const idx = messages.findIndex((m) => m.id === lastKnownMessageId);
  // If we can't locate the anchor (e.g. deleted), consider every message; a
  // single inbound from someone else still counts as replied.
  const newer = idx >= 0 ? messages.slice(idx + 1) : messages;
  return newer.some((m) => {
    const fromEmail = emailFromHeader(header(m.payload, "From"));
    return fromEmail !== "" && !mine.has(fromEmail);
  });
}

/**
 * Process every follow-up that has reached its remind time. Threads that got a
 * reply are marked "replied" (cleared); threads still waiting are surfaced
 * (a one-time realtime nudge). Best-effort per row — a failed Gmail call leaves
 * the row so the next pass retries. Scope to one user for opportunistic runs.
 */
export async function processDueFollowUps(
  opts: { userId?: string } = {},
): Promise<{ replied: number; surfaced: number }> {
  const due = await prisma.followUp.findMany({
    where: {
      status: "waiting",
      remindAt: { lte: new Date() },
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    take: 200,
  });

  let replied = 0;
  let surfaced = 0;

  for (const row of due) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: row.userId },
        select: { email: true, connectedEmail: true },
      });
      if (!user) continue;

      const tenantId = await ensureCorsairTenant(row.userId);
      const t = corsairTenant(tenantId);
      const res = await getThread(t, row.threadId);
      if (!res.success) continue; // leave the row; retry next pass

      const messages = res.data.messages ?? [];
      if (hasInboundReply(messages, row.lastKnownMessageId, myAddresses(user))) {
        await prisma.followUp.update({
          where: { id: row.id },
          data: { status: "replied" },
        });
        publish(row.userId, { plugin: "gmail", type: "follow-up-replied", at: Date.now() });
        replied++;
      } else if (!row.surfacedAt) {
        await prisma.followUp.update({
          where: { id: row.id },
          data: { surfacedAt: new Date() },
        });
        publish(row.userId, { plugin: "gmail", type: "follow-up-due", at: Date.now() });
        surfaced++;
      }
    } catch (err) {
      console.error(`follow-up: processing failed for thread ${row.threadId}:`, err);
    }
  }

  return { replied, surfaced };
}

export type ActiveFollowUp = {
  threadId: string;
  subject: string | null;
  contact: string | null;
  remindAt: Date;
  note: string | null;
};

/**
 * Follow-ups that need the user's attention now: armed, past their remind time.
 * Powers the inbox banner and the daily brief.
 */
export async function listSurfacedFollowUps(userId: string): Promise<ActiveFollowUp[]> {
  const rows = await prisma.followUp.findMany({
    where: { userId, status: "waiting", remindAt: { lte: new Date() } },
    orderBy: { remindAt: "asc" },
    take: 25,
    select: { threadId: true, subject: true, contact: true, remindAt: true, note: true },
  });
  return rows;
}

/** Look up the follow-up state for a single thread (for the thread-page button). */
export async function getFollowUp(userId: string, threadId: string) {
  return prisma.followUp.findUnique({
    where: { userId_threadId: { userId, threadId } },
    select: { status: true, remindAt: true },
  });
}
