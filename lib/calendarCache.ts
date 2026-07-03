import "server-only";

import { prisma } from "@/lib/prisma";
import { eventStartMillis, eventEndMillis, isAllDay } from "@/lib/gcalTime";
import type { CachedEvent, CalendarSummary } from "@/lib/gcal";

/**
 * Local Postgres cache for Google Calendar content, mirroring lib/mailCache.ts.
 * `googlecalendar.db.events.search` only stores refs (no summary/start/end), so
 * every render would otherwise hit `api.events.getMany` live. We persist full
 * event payloads here so the calendar renders from our DB instantly; freshness
 * comes from a background sync (60s client poll + cron), not from re-fetching
 * on every render.
 */

function rowToCachedEvent(row: { data: unknown }): CachedEvent {
  return row.data as CachedEvent;
}

/** Events overlapping [startMs, endMs), ordered by start time. */
export async function getCachedEventsInRange(
  userId: string,
  startMs: number,
  endMs: number,
): Promise<CachedEvent[]> {
  const rows = await prisma.cachedEvent.findMany({
    where: {
      userId,
      status: { not: "cancelled" },
      startMs: { lt: BigInt(endMs) },
      endMs: { gt: BigInt(startMs) },
    },
    orderBy: { startMs: "asc" },
  });
  return rows.map(rowToCachedEvent);
}

function eventRow(userId: string, e: CachedEvent & { id: string }) {
  return {
    userId,
    eventId: e.id,
    calendarId: e.calendarId ?? "primary",
    title: e.summary || "(no title)",
    startMs: BigInt(eventStartMillis(e)),
    endMs: BigInt(eventEndMillis(e)),
    isAllDay: isAllDay(e),
    status: e.status ?? "confirmed",
    data: e as object,
  };
}

/** Upsert hydrated events into the cache (best-effort, never throws). */
export async function putCachedEvents(userId: string, events: CachedEvent[]): Promise<void> {
  const withIds = events.filter((e): e is CachedEvent & { id: string } => Boolean(e.id));
  if (withIds.length === 0) return;
  await Promise.all(
    withIds.map((e) => {
      const row = eventRow(userId, e);
      return prisma.cachedEvent
        .upsert({
          where: { userId_eventId: { userId, eventId: e.id } },
          create: row,
          update: row,
        })
        .catch(() => {});
    }),
  );
}

/**
 * Replace every cached event overlapping [startMs, endMs) with a fresh set —
 * the sync entry point. Handles remote deletions cleanly (a deleted event
 * simply isn't in `events` and so isn't re-inserted).
 */
export async function replaceWindow(
  userId: string,
  startMs: number,
  endMs: number,
  events: CachedEvent[],
): Promise<void> {
  const rows = events
    .filter((e): e is CachedEvent & { id: string } => Boolean(e.id))
    .map((e) => eventRow(userId, e));
  await prisma
    .$transaction([
      prisma.cachedEvent.deleteMany({
        where: { userId, startMs: { lt: BigInt(endMs) }, endMs: { gt: BigInt(startMs) } },
      }),
      prisma.cachedEvent.createMany({ data: rows, skipDuplicates: true }),
    ])
    .catch(() => {});
}

/** Read a single cached event by Gmail-style id, or null on miss. */
export async function getCachedEvent(userId: string, eventId: string): Promise<CachedEvent | null> {
  const row = await prisma.cachedEvent
    .findUnique({ where: { userId_eventId: { userId, eventId } } })
    .catch(() => null);
  return row ? rowToCachedEvent(row) : null;
}

/** Drop a cached event (e.g. after a delete mutation). */
export async function dropCachedEvent(userId: string, eventId: string): Promise<void> {
  await prisma.cachedEvent.deleteMany({ where: { userId, eventId } }).catch(() => {});
}

// --- Sync window state (CalendarSyncState) ---

const SYNC_STALE_MS = 120_000;

export type SyncStateHit = {
  calendars: CalendarSummary[];
  syncStartMs: number;
  syncEndMs: number;
  fetchedAt: Date;
  stale: boolean;
};

/** Read the currently-synced window + calendar list (with staleness flag). */
export async function getSyncState(userId: string): Promise<SyncStateHit | null> {
  const row = await prisma.calendarSyncState.findUnique({ where: { userId } }).catch(() => null);
  if (!row) return null;
  return {
    calendars: row.calendarsData as unknown as CalendarSummary[],
    syncStartMs: Number(row.syncStartMs),
    syncEndMs: Number(row.syncEndMs),
    fetchedAt: row.fetchedAt,
    stale: Date.now() - row.fetchedAt.getTime() > SYNC_STALE_MS,
  };
}

/** Store/refresh the synced window + calendar list. */
export async function putSyncState(
  userId: string,
  data: { calendars: CalendarSummary[]; syncStartMs: number; syncEndMs: number },
): Promise<void> {
  const fields = {
    calendarsData: data.calendars as object,
    syncStartMs: BigInt(data.syncStartMs),
    syncEndMs: BigInt(data.syncEndMs),
    fetchedAt: new Date(),
  };
  await prisma.calendarSyncState
    .upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    })
    .catch(() => {});
}
