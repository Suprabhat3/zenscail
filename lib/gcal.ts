import "server-only";

import type { TenantScope } from "@corsair-dev/app";

// --- Google Calendar event types (subset we use) ---

export type GcalEventTime = {
  date?: string; // all-day, "YYYY-MM-DD"
  dateTime?: string; // RFC 3339
  timeZone?: string;
};

export type GcalAttendee = {
  email?: string;
  displayName?: string;
  organizer?: boolean;
  self?: boolean;
  optional?: boolean;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
};

export type GcalEvent = {
  id?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GcalEventTime;
  end?: GcalEventTime;
  attendees?: GcalAttendee[];
  hangoutLink?: string;
  recurringEventId?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
};

/**
 * Row shape of Corsair's calendar event cache (googlecalendar.db.events.search).
 * Defensive guess like CachedMessage in lib/gmail.ts — the cache exposes the
 * filterable scalar columns plus (assumed) the nested start/end/attendees JSON.
 * Verify and tighten once real data flows.
 */
export type CachedEvent = GcalEvent & {
  calendarId?: string;
  created?: string;
  updated?: string;
  createdAt?: string;
};

// --- Helpers ---

function normalizeRows<T>(data: T[] | { results?: T[] } | unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export function eventStartMillis(e: GcalEvent): number {
  const s = e.start?.dateTime ?? e.start?.date;
  if (!s) return 0;
  const d = Date.parse(s);
  return Number.isNaN(d) ? 0 : d;
}

export function eventEndMillis(e: GcalEvent): number {
  const s = e.end?.dateTime ?? e.end?.date;
  if (!s) return eventStartMillis(e);
  const d = Date.parse(s);
  return Number.isNaN(d) ? eventStartMillis(e) : d;
}

export function isAllDay(e: GcalEvent): boolean {
  return Boolean(e.start?.date && !e.start?.dateTime);
}

// --- Operations (all take a tenant scope from corsairTenant()) ---

/**
 * Read cached events and filter to [rangeStart, rangeEnd) in app code —
 * the events cache has no filterable start/end columns (see corsair-reference.md).
 */
export async function searchCachedEvents(
  t: TenantScope,
  opts: { rangeStart?: Date; rangeEnd?: Date; limit?: number } = {},
): Promise<CachedEvent[]> {
  const result = await t.run<CachedEvent[] | { results?: CachedEvent[] }>(
    "googlecalendar.db.events.search",
    { limit: opts.limit ?? 500 },
  );
  if (!result.success) return [];
  let rows = normalizeRows<CachedEvent>(result.data).filter(
    (e) => e.status !== "cancelled",
  );
  if (opts.rangeStart || opts.rangeEnd) {
    const min = opts.rangeStart?.getTime() ?? -Infinity;
    const max = opts.rangeEnd?.getTime() ?? Infinity;
    // Keep events that overlap the range at all.
    rows = rows.filter((e) => eventEndMillis(e) > min && eventStartMillis(e) < max);
  }
  return rows.sort((a, b) => eventStartMillis(a) - eventStartMillis(b));
}

/** Pull fresh events from the Google Calendar API into Corsair's cache. */
export async function refreshEvents(
  t: TenantScope,
  opts: { timeMin?: Date; timeMax?: Date; maxResults?: number } = {},
) {
  return t.run("googlecalendar.api.events.getMany", {
    singleEvents: true,
    orderBy: "startTime",
    maxResults: opts.maxResults ?? 250,
    ...(opts.timeMin ? { timeMin: opts.timeMin.toISOString() } : {}),
    ...(opts.timeMax ? { timeMax: opts.timeMax.toISOString() } : {}),
  });
}

export type EventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: GcalEventTime;
  end: GcalEventTime;
  attendees?: GcalAttendee[];
};

export async function createEvent(t: TenantScope, event: EventInput) {
  return t.run<GcalEvent>("googlecalendar.api.events.create", {
    event,
    sendUpdates: "all", // attendees get real invite emails
  });
}

export async function updateEvent(t: TenantScope, id: string, event: EventInput) {
  return t.run<GcalEvent>("googlecalendar.api.events.update", {
    id,
    event,
    sendUpdates: "all",
  });
}

export async function deleteEvent(t: TenantScope, id: string) {
  return t.run("googlecalendar.api.events.delete", { id, sendUpdates: "all" });
}

export type BusySlot = { start?: string; end?: string };

/** Free/busy for the primary calendar over [timeMin, timeMax]. */
export async function getAvailability(
  t: TenantScope,
  timeMin: Date,
  timeMax: Date,
): Promise<BusySlot[]> {
  const result = await t.run<{
    calendars?: Record<string, { busy?: BusySlot[] }>;
  }>("googlecalendar.api.calendar.getAvailability", {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    items: [{ id: "primary" }],
  });
  if (!result.success) return [];
  const calendars = result.data.calendars ?? {};
  return Object.values(calendars).flatMap((c) => c.busy ?? []);
}
