import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getAvailability, type BusySlot } from "@/lib/gcal";

export type BookingLinkRow = {
  id: number;
  slug: string;
  userId: string;
  title: string;
  durationMins: number;
  windowDays: number;
  hoursStart: number;
  hoursEnd: number;
  timezone: string;
  active: boolean;
};

/** A bookable instant, grouped by local day for the picker. */
export type Slot = { startIso: string; endIso: string };
export type DaySlots = { date: string; label: string; slots: { iso: string; label: string }[] };

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** URL-safe, unguessable slug (no external dep — crypto randomBytes). */
export function mintSlug(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

/**
 * Offset (ms) of `timeZone` from UTC at the given instant. Positive east of
 * UTC. Uses Intl to read the zone's wall-clock and diffs it against UTC.
 */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Absolute instant for a wall-clock time (y/m/d h:m) in `timeZone`. */
function wallClockToInstant(
  timeZone: string,
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
): Date {
  const guess = Date.UTC(y, m, d, hour, minute);
  // Correct using the offset at the guessed instant (good enough away from DST seams).
  const offset = tzOffsetMs(timeZone, new Date(guess));
  return new Date(guess - offset);
}

/** The y/m/d of `date` as seen in `timeZone`. */
function ymdInZone(timeZone: string, date: Date): { y: number; m: number; d: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

function overlaps(startMs: number, endMs: number, busy: BusySlot[]): boolean {
  return busy.some((b) => {
    const bs = b.start ? Date.parse(b.start) : NaN;
    const be = b.end ? Date.parse(b.end) : NaN;
    if (Number.isNaN(bs) || Number.isNaN(be)) return false;
    return startMs < be && endMs > bs;
  });
}

/**
 * Open slots for a booking link over its window, in the owner's timezone,
 * snapped to the duration and minus busy times from their calendar. `now`
 * is the reference instant (so the public page can pass server time).
 */
export async function computeOpenSlots(
  link: BookingLinkRow,
  now: Date,
  maxPerDay = 12,
): Promise<DaySlots[]> {
  const tenantId = await ensureCorsairTenant(link.userId);
  const t = corsairTenant(tenantId);

  const windowEnd = new Date(now.getTime() + link.windowDays * 86400_000);
  const busy = await getAvailability(t, now, windowEnd);

  const days: DaySlots[] = [];
  const stepMs = link.durationMins * 60_000;
  const startYmd = ymdInZone(link.timezone, now);
  const base = new Date(Date.UTC(startYmd.y, startYmd.m - 1, startYmd.d));

  for (let dayOffset = 0; dayOffset < link.windowDays; dayOffset++) {
    const dayDate = new Date(base.getTime() + dayOffset * 86400_000);
    const { y, m, d } = ymdInZone("UTC", dayDate); // base built in UTC midnight
    const slots: { iso: string; label: string }[] = [];
    // Walk the working window in duration-sized steps from hoursStart.
    const dayClose = wallClockToInstant(link.timezone, y, m - 1, d, link.hoursEnd, 0).getTime();
    let cursor = wallClockToInstant(link.timezone, y, m - 1, d, link.hoursStart, 0).getTime();
    while (cursor + stepMs <= dayClose && slots.length < maxPerDay) {
      const startMs = cursor;
      const endMs = cursor + stepMs;
      cursor = endMs;
      if (startMs <= now.getTime()) continue;
      if (overlaps(startMs, endMs, busy)) continue;
      slots.push({
        iso: new Date(startMs).toISOString(),
        label: new Date(startMs).toLocaleTimeString("en-US", {
          timeZone: link.timezone,
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }

    if (slots.length > 0) {
      const dayInstant = wallClockToInstant(link.timezone, y, m - 1, d, 12, 0);
      days.push({
        date: new Date(dayInstant).toISOString(),
        label: new Date(dayInstant).toLocaleDateString("en-US", {
          timeZone: link.timezone,
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        slots,
      });
    }
  }

  return days;
}

/** Re-check a specific slot is still free immediately before booking. */
export async function slotIsFree(
  link: BookingLinkRow,
  startIso: string,
): Promise<boolean> {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return false;
  if (startMs <= Date.now()) return false;
  const endMs = startMs + link.durationMins * 60_000;
  const tenantId = await ensureCorsairTenant(link.userId);
  const t = corsairTenant(tenantId);
  const busy = await getAvailability(t, new Date(startMs - 1000), new Date(endMs + 1000));
  return !overlaps(startMs, endMs, busy);
}

export async function getBookingLink(slug: string): Promise<BookingLinkRow | null> {
  const row = await prisma.bookingLink.findUnique({ where: { slug } });
  if (!row || !row.active) return null;
  return row;
}
