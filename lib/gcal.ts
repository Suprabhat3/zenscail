import "server-only";

import { after } from "next/server";
import type { TenantScope } from "@corsair-dev/app";
import {
  getCachedEventsInRange,
  putCachedEvents,
  replaceWindow,
  getSyncState,
  putSyncState,
} from "@/lib/calendarCache";
import { eventStartMillis, eventEndMillis, isAllDay } from "@/lib/gcalTime";

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

export type EventReminder = { method: "popup" | "email"; minutes: number };

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
  recurrence?: string[];
  visibility?: "default" | "public" | "private";
  transparency?: "opaque" | "transparent";
  colorId?: string;
  reminders?: { useDefault?: boolean; overrides?: EventReminder[] };
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOtherGuests?: boolean;
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

export { eventStartMillis, eventEndMillis, isAllDay };

// --- Operations (all take a tenant scope from corsairTenant()) ---

/**
 * List events in [rangeStart, rangeEnd) with full content.
 *
 * NOTE: like the Gmail message cache, `googlecalendar.db.events.search` only
 * stores minimal refs (no summary/start/end) — reading content from it yields
 * "(no title)" rows that also get filtered out (undefined start/end → millis 0).
 * So we read directly from `api.events.getMany`, which returns full event
 * objects and does the time-range filtering server-side. Returns `ok:false`
 * when the tenant isn't connected (caller redirects to /connect).
 */
export async function searchCachedEvents(
  t: TenantScope,
  opts: { rangeStart?: Date; rangeEnd?: Date; limit?: number } = {},
): Promise<CachedEvent[]> {
  const { messages: rows } = await listEvents(t, opts);
  return rows;
}

export async function listEvents(
  t: TenantScope,
  opts: { rangeStart?: Date; rangeEnd?: Date; limit?: number } = {},
): Promise<{ ok: boolean; messages: CachedEvent[] }> {
  const result = await t.run<CachedEvent[] | { items?: CachedEvent[]; results?: CachedEvent[] }>(
    "googlecalendar.api.events.getMany",
    {
      singleEvents: true,
      orderBy: "startTime",
      maxResults: opts.limit ?? 250,
      ...(opts.rangeStart ? { timeMin: opts.rangeStart.toISOString() } : {}),
      ...(opts.rangeEnd ? { timeMax: opts.rangeEnd.toISOString() } : {}),
    },
  );
  if (!result.success) return { ok: false, messages: [] };
  const data = result.data as CachedEvent[] | { items?: CachedEvent[]; results?: CachedEvent[] };
  const items =
    !Array.isArray(data) && data && Array.isArray(data.items)
      ? data.items
      : normalizeRows<CachedEvent>(data);
  const rows = items
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => eventStartMillis(a) - eventStartMillis(b));
  return { ok: true, messages: rows };
}

export type CalendarSummary = {
  id: string;
  summary: string;
  timeZone?: string;
};

/**
 * Best-effort list of the user's calendars for the sidebar, read from the
 * `googlecalendar.db.calendars.search` cache. Like the other caches this may be
 * sparsely populated, so entries without a usable summary are dropped. Returns
 * `[]` (never throws) when unconnected/empty — the sidebar falls back to a
 * single "Primary" entry in that case.
 */
export async function listCalendars(t: TenantScope): Promise<CalendarSummary[]> {
  const res = await t.run<
    | { id?: string; summary?: string; timeZone?: string }[]
    | { results?: { id?: string; summary?: string; timeZone?: string }[] }
  >("googlecalendar.db.calendars.search", { limit: 50 });
  if (!res.success) return [];
  const rows = normalizeRows<{ id?: string; summary?: string; timeZone?: string }>(res.data);
  return rows
    .filter((c): c is { id: string; summary: string; timeZone?: string } =>
      Boolean(c.id && c.summary),
    )
    .map((c) => ({ id: c.id, summary: c.summary, timeZone: c.timeZone }))
    .sort((a, b) => a.summary.localeCompare(b.summary));
}

// --- DB-first calendar cache (mirrors gmail.ts's cache-first pattern) ---

const SYNC_WINDOW_BEFORE_MS = 30 * 86400_000;
const SYNC_WINDOW_AFTER_MS = 90 * 86400_000;

/**
 * Full background sync: pull [-30d, +90d] of events plus the calendar list
 * live, then replace the cached window in one shot. The single entry point
 * for keeping CachedEvent warm (first visit, background refresh, poller, cron).
 */
export async function syncCalendarWindow(t: TenantScope, userId: string): Promise<boolean> {
  const now = Date.now();
  const syncStartMs = now - SYNC_WINDOW_BEFORE_MS;
  const syncEndMs = now + SYNC_WINDOW_AFTER_MS;
  const [eventsRes, calendars] = await Promise.all([
    listEvents(t, { rangeStart: new Date(syncStartMs), rangeEnd: new Date(syncEndMs), limit: 250 }),
    listCalendars(t).catch(() => []),
  ]);
  if (!eventsRes.ok) return false;
  await replaceWindow(userId, syncStartMs, syncEndMs, eventsRes.messages);
  await putSyncState(userId, { calendars, syncStartMs, syncEndMs });
  return true;
}

/**
 * Cache-first calendar read for a given visible range. On a cold cache (first
 * visit) this blocks on one full sync; otherwise it reads Postgres and kicks a
 * non-blocking background sync when stale. A range outside the synced window
 * (deep past/future navigation) falls back to one live fetch for that range
 * without touching the sync window.
 */
export async function listEventsCached(
  t: TenantScope,
  userId: string,
  opts: { rangeStart: Date; rangeEnd: Date },
): Promise<{ ok: boolean; messages: CachedEvent[]; calendars: CalendarSummary[] }> {
  const rangeStartMs = opts.rangeStart.getTime();
  const rangeEndMs = opts.rangeEnd.getTime();

  const state = await getSyncState(userId);
  if (!state) {
    const ok = await syncCalendarWindow(t, userId);
    if (!ok) return { ok: false, messages: [], calendars: [] };
    const fresh = await getSyncState(userId);
    const messages = await getCachedEventsInRange(userId, rangeStartMs, rangeEndMs);
    return { ok: true, messages, calendars: fresh?.calendars ?? [] };
  }

  if (state.stale) {
    after(async () => {
      await syncCalendarWindow(t, userId).catch(() => {});
    });
  }

  if (rangeStartMs < state.syncStartMs || rangeEndMs > state.syncEndMs) {
    const live = await listEvents(t, { rangeStart: opts.rangeStart, rangeEnd: opts.rangeEnd });
    if (!live.ok) return { ok: false, messages: [], calendars: state.calendars };
    await putCachedEvents(userId, live.messages);
    return { ok: true, messages: live.messages, calendars: state.calendars };
  }

  const messages = await getCachedEventsInRange(userId, rangeStartMs, rangeEndMs);
  return { ok: true, messages, calendars: state.calendars };
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
  recurrence?: string[];
  visibility?: "default" | "public" | "private";
  transparency?: "opaque" | "transparent";
  colorId?: string;
  reminders?: { useDefault: boolean; overrides?: EventReminder[] };
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  // When set, a Google Meet link is requested for the event.
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: "hangoutsMeet" };
    };
  };
};

export async function createEvent(t: TenantScope, event: EventInput) {
  return t.run<GcalEvent>("googlecalendar.api.events.create", {
    event,
    sendUpdates: "all", // attendees get real invite emails
    ...(event.conferenceData ? { conferenceDataVersion: 1 } : {}),
  });
}

export async function updateEvent(t: TenantScope, id: string, event: EventInput) {
  return t.run<GcalEvent>("googlecalendar.api.events.update", {
    id,
    event,
    sendUpdates: "all",
    ...(event.conferenceData ? { conferenceDataVersion: 1 } : {}),
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
