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

type CachedMessageRow = {
  gmailMessageId: string;
  threadId: string;
  fromAddr: string;
  subject: string;
  snippet: string;
  internalDate: bigint;
  unread: boolean;
  labelIds: string[];
  hasListUnsubscribe: boolean;
};

function rowToInboxMessage(r: CachedMessageRow): InboxMessage {
  return {
    id: r.gmailMessageId,
    threadId: r.threadId,
    from: r.fromAddr,
    subject: r.subject,
    snippet: r.snippet,
    internalDate: Number(r.internalDate),
    unread: r.unread,
    labelIds: r.labelIds,
    hasListUnsubscribe: r.hasListUnsubscribe,
  };
}

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
    map.set(r.gmailMessageId, rowToInboxMessage(r));
  }
  return map;
}

type CachedMessageWhere = NonNullable<Parameters<typeof prisma.cachedMessage.findMany>[0]>["where"];

/**
 * Read a page of the cached inbox for a folder/label view, entirely from
 * Postgres — no Corsair call. `labelIds` empty/undefined means "all mail"
 * (TRASH/SPAM excluded unless explicitly requested via `labelIds`).
 */
export async function listCachedInbox(
  userId: string,
  opts: { labelIds?: string[]; unreadOnly?: boolean; limit: number; offset: number },
): Promise<{ messages: InboxMessage[]; total: number }> {
  const { labelIds, unreadOnly, limit, offset } = opts;
  const where: CachedMessageWhere = {
    userId,
    ...(unreadOnly ? { unread: true } : {}),
    ...(labelIds && labelIds.length > 0
      ? { labelIds: { hasEvery: labelIds } }
      : { NOT: [{ labelIds: { has: "TRASH" } }, { labelIds: { has: "SPAM" } }] }),
  };
  const [rows, total] = await Promise.all([
    prisma.cachedMessage.findMany({
      where,
      orderBy: { internalDate: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.cachedMessage.count({ where }),
  ]);
  return { messages: rows.map(rowToInboxMessage), total };
}

/**
 * Drop `labelId` from cached rows that carry it but are no longer present in
 * a fresh live list of that label's top messages — e.g. mail archived/deleted
 * outside the app. Only inspects the cached rows within the live window so it
 * never touches older mail the live call didn't cover. Best-effort.
 */
export async function reconcileInboxWindow(
  userId: string,
  labelId: string,
  liveIds: string[],
): Promise<void> {
  const windowRows = await prisma.cachedMessage
    .findMany({
      where: { userId, labelIds: { has: labelId } },
      orderBy: { internalDate: "desc" },
      take: 25,
      select: { gmailMessageId: true, labelIds: true },
    })
    .catch(() => []);
  const live = new Set(liveIds);
  const stale = windowRows.filter((r) => !live.has(r.gmailMessageId));
  if (stale.length === 0) return;

  await Promise.all(
    stale.map((r) => {
      const nextLabels = r.labelIds.filter((l) => l !== labelId);
      return nextLabels.length === 0
        ? prisma.cachedMessage
            .deleteMany({ where: { userId, gmailMessageId: r.gmailMessageId } })
            .catch(() => {})
        : prisma.cachedMessage
            .update({
              where: { userId_gmailMessageId: { userId, gmailMessageId: r.gmailMessageId } },
              data: { labelIds: nextLabels },
            })
            .catch(() => {});
    }),
  );
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

// --- Sidebar label data (CachedLabelData) ---

export type LabelData = {
  custom: { id: string; name: string; unread: number }[];
  unread: Record<string, number>;
};

const LABEL_STALE_MS = 5 * 60_000;

export type CachedLabelDataHit = { data: LabelData; fetchedAt: Date; stale: boolean };

/** Read cached sidebar label data (with staleness flag) or null on miss. */
export async function getCachedLabelData(userId: string): Promise<CachedLabelDataHit | null> {
  const row = await prisma.cachedLabelData.findUnique({ where: { userId } }).catch(() => null);
  if (!row) return null;
  return {
    data: row.data as unknown as LabelData,
    fetchedAt: row.fetchedAt,
    stale: nowMs() - row.fetchedAt.getTime() > LABEL_STALE_MS,
  };
}

/** Store/refresh the sidebar label data. */
export async function putCachedLabelData(userId: string, data: LabelData): Promise<void> {
  await prisma.cachedLabelData
    .upsert({
      where: { userId },
      create: { userId, data: data as object, fetchedAt: nowDate() },
      update: { data: data as object, fetchedAt: nowDate() },
    })
    .catch(() => {});
}

function nowMs(): number {
  return Date.now();
}
function nowDate(): Date {
  return new Date();
}
