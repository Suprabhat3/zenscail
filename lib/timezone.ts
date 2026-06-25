import { cookies } from "next/headers";

/**
 * Viewer-local timezone handling for server-rendered pages.
 *
 * Server components run in the host's timezone (our VPS is UTC), so any
 * `toLocaleString()` / date math there renders in UTC — not the user's zone.
 * The fix: `TimeZoneSync` (client) writes the browser's IANA zone into the `tz`
 * cookie; server pages read it via `getUserTimeZone()` and format / compute
 * against it. Same cookie-driven pattern as `mail_layout`.
 *
 * The pure helpers below all take an explicit `tz` so date math (start-of-day,
 * week boundaries, "is it today", hour-of-day for the calendar grid) happens in
 * the viewer's zone regardless of where the code runs.
 */

export const TZ_COOKIE = "tz";

function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The viewer's IANA timezone from the `tz` cookie. Falls back to "UTC" on the
 * very first paint (before the cookie exists); `TimeZoneSync` then sets it and
 * refreshes, so subsequent renders use the real zone.
 */
export async function getUserTimeZone(): Promise<string> {
  const raw = (await cookies()).get(TZ_COOKIE)?.value ?? "";
  return isValidTimeZone(raw) ? raw : "UTC";
}

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  weekday: number; // 0 = Monday … 6 = Sunday
};

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function partsFormatter(tz: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

/** Break an instant into its wall-clock fields in `tz`. */
export function partsInTZ(ms: number, tz: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

/** Offset (ms, east-of-UTC positive) of `tz` at instant `ms`. */
function tzOffsetMs(ms: number, tz: string): number {
  const p = partsInTZ(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const msToMinute = Math.floor(ms / 60_000) * 60_000;
  return asUtc - msToMinute;
}

/**
 * Real epoch ms for a wall-clock moment in `tz`. `month` is 1-based; out-of-range
 * month/day values normalize (Date.UTC semantics), so `day + n` / `month + n`
 * advance correctly. Re-derives the offset at the corrected instant so DST
 * transitions land right.
 */
export function zonedToMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const corrected = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(corrected, tz);
}

/** Epoch ms of local midnight for the day containing `ms`, in `tz`. */
export function startOfDayMs(ms: number, tz: string): number {
  const p = partsInTZ(ms, tz);
  return zonedToMs(p.year, p.month, p.day, 0, 0, tz);
}

/** Local midnight `n` days from `ms` in `tz` (DST-safe; `n` may be negative). */
export function addDaysMs(ms: number, n: number, tz: string): number {
  const p = partsInTZ(ms, tz);
  return zonedToMs(p.year, p.month, p.day + n, 0, 0, tz);
}

/** Local midnight `n` months from `ms` in `tz` (keeps day-of-month, JS overflow). */
export function addMonthsMs(ms: number, n: number, tz: string): number {
  const p = partsInTZ(ms, tz);
  return zonedToMs(p.year, p.month + n, p.day, 0, 0, tz);
}

/** First-of-month local midnight for the month containing `ms`, in `tz`. */
export function startOfMonthMs(ms: number, tz: string): number {
  const p = partsInTZ(ms, tz);
  return zonedToMs(p.year, p.month, 1, 0, 0, tz);
}

/** Monday-based start-of-week local midnight for the week containing `ms`. */
export function startOfWeekMs(ms: number, tz: string): number {
  const p = partsInTZ(ms, tz);
  const midnight = zonedToMs(p.year, p.month, p.day, 0, 0, tz);
  return addDaysMs(midnight, -p.weekday, tz);
}

/** "YYYY-MM-DD" for the day containing `ms`, in `tz`. */
export function ymdInTZ(ms: number, tz: string): string {
  const p = partsInTZ(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Format a timestamp in `tz`. Accepts epoch ms, an ISO/parseable string, or a
 * Date. Returns "" for unparseable input.
 */
export function formatInTZ(
  value: number | string | Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: tz, ...opts });
}
