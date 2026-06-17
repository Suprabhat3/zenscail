import "server-only";

import { prisma } from "@/lib/prisma";
import type { InboxMessage, GmailThread } from "@/lib/gmail";

/**
 * Local Postgres cache for Gmail content. Corsair's own cache is content-less
 * (only id/threadId refs), so every render would otherwise re-hydrate sender/
 * subject/snippet via N gmail.api.messages.get calls and re-fetch full thread
 * bodies. We persist hydrated rows here so the inbox and a re-opened thread
 * render from our DB instantly; freshness comes from the 60s client poll (and,
 * best-effort, the Corsair webhook), not from re-fetching on every render.
 */

// --- Inbox rows (CachedMessage) ---

/** Read cached inbox rows for the given gmail message ids, keyed by id. */
export async function getCachedMessages(
  userId: string,
  ids: string[],
): Promise<Map<string, InboxMessage>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.cachedMessage.findMany({
    where: { userId, gmailMessageId: { in: ids } },
  });
  const map = new Map<string, InboxMessage>();
  for (const r of rows) {
    map.set(r.gmailMessageId, {
      id: r.gmailMessageId,
      threadId: r.threadId,
      from: r.fromAddr,
      subject: r.subject,
      snippet: r.snippet,
      internalDate: Number(r.internalDate),
      unread: r.unread,
      labelIds: r.labelIds,
      hasListUnsubscribe: r.hasListUnsubscribe,
    });
  }
  return map;
}

/** Upsert hydrated inbox rows into the cache (best-effort, never throws). */
export async function putCachedMessages(
  userId: string,
  messages: InboxMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  await Promise.all(
    messages.map((m) =>
      prisma.cachedMessage
        .upsert({
          where: { userId_gmailMessageId: { userId, gmailMessageId: m.id } },
          create: {
            userId,
            gmailMessageId: m.id,
            threadId: m.threadId,
            fromAddr: m.from,
            subject: m.subject,
            snippet: m.snippet,
            internalDate: BigInt(m.internalDate),
            unread: m.unread,
            labelIds: m.labelIds,
            hasListUnsubscribe: m.hasListUnsubscribe,
          },
          update: {
            threadId: m.threadId,
            fromAddr: m.from,
            subject: m.subject,
            snippet: m.snippet,
            internalDate: BigInt(m.internalDate),
            unread: m.unread,
            labelIds: m.labelIds,
            hasListUnsubscribe: m.hasListUnsubscribe,
          },
        })
        .catch(() => {}),
    ),
  );
}

/** Mark every cached message in a thread read (mirrors markThreadRead). */
export async function markThreadReadInCache(
  userId: string,
  threadId: string,
): Promise<void> {
  await prisma.cachedMessage
    .updateMany({
      where: { userId, threadId },
      data: { unread: false },
    })
    .catch(() => {});
}

/** Mark specific cached messages read by gmail id (single or batch). */
export async function markMessagesReadInCache(
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await prisma.cachedMessage
    .updateMany({
      where: { userId, gmailMessageId: { in: ids } },
      data: { unread: false },
    })
    .catch(() => {});
}

/** Drop cached messages by gmail id (e.g. on trash/archive). */
export async function dropCachedMessages(
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await prisma.cachedMessage
    .deleteMany({ where: { userId, gmailMessageId: { in: ids } } })
    .catch(() => {});
}

/** Drop a single cached message (e.g. on trash). */
export async function dropCachedMessage(
  userId: string,
  gmailMessageId: string,
): Promise<void> {
  await prisma.cachedMessage
    .deleteMany({ where: { userId, gmailMessageId } })
    .catch(() => {});
}

// --- Threads (CachedThread) ---

const THREAD_STALE_MS = 60_000;

export type CachedThreadHit = {
  data: GmailThread;
  fetchedAt: Date;
  stale: boolean;
};

/** Read a cached thread (with staleness flag) or null on miss. */
export async function getCachedThread(
  userId: string,
  threadId: string,
): Promise<CachedThreadHit | null> {
  const row = await prisma.cachedThread
    .findUnique({ where: { userId_threadId: { userId, threadId } } })
    .catch(() => null);
  if (!row) return null;
  return {
    data: row.data as unknown as GmailThread,
    fetchedAt: row.fetchedAt,
    stale: nowMs() - row.fetchedAt.getTime() > THREAD_STALE_MS,
  };
}

/** Store/refresh a full thread payload. */
export async function putCachedThread(
  userId: string,
  threadId: string,
  data: GmailThread,
): Promise<void> {
  await prisma.cachedThread
    .upsert({
      where: { userId_threadId: { userId, threadId } },
      create: { userId, threadId, data: data as object, fetchedAt: nowDate() },
      update: { data: data as object, fetchedAt: nowDate() },
    })
    .catch(() => {});
}

/** Invalidate a cached thread so the next open re-fetches (e.g. after a reply). */
export async function dropCachedThread(
  userId: string,
  threadId: string,
): Promise<void> {
  await prisma.cachedThread
    .deleteMany({ where: { userId, threadId } })
    .catch(() => {});
}

function nowMs(): number {
  return Date.now();
}
function nowDate(): Date {
  return new Date();
}
