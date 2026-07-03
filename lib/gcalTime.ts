import "server-only";

/**
 * Pure date-math helpers shared by lib/gcal.ts and lib/calendarCache.ts.
 * Split out so the cache layer can compute startMs/endMs/isAllDay without
 * creating a runtime import cycle with lib/gcal.ts (which imports the cache
 * layer's read/write functions).
 */

export type GcalEventTimeLike = { date?: string; dateTime?: string };
export type GcalEventLike = { start?: GcalEventTimeLike; end?: GcalEventTimeLike };

export function eventStartMillis(e: GcalEventLike): number {
  const s = e.start?.dateTime ?? e.start?.date;
  if (!s) return 0;
  const d = Date.parse(s);
  return Number.isNaN(d) ? 0 : d;
}

export function eventEndMillis(e: GcalEventLike): number {
  const s = e.end?.dateTime ?? e.end?.date;
  if (!s) return eventStartMillis(e);
  const d = Date.parse(s);
  return Number.isNaN(d) ? eventStartMillis(e) : d;
}

export function isAllDay(e: GcalEventLike): boolean {
  return Boolean(e.start?.date && !e.start?.dateTime);
}
