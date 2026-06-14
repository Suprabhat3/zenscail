/**
 * Client-safe time-preset helpers for Snooze and Send Later. Computed in the
 * browser so they respect the user's local timezone. Each preset is materialised
 * to a concrete Date at call time (not memoised) so "tomorrow" is always right.
 */

export type TimePreset = { label: string; hint: string; date: Date };

function at(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** "Jun 16, 8:00 AM" — for confirmation toasts. */
export function fmtDateTime(d: Date): string {
  return `${fmtDay(d)}, ${fmtTime(d)}`;
}

function nextWeekday(from: Date, targetDow: number, hour: number): Date {
  const d = at(from, hour);
  let add = (targetDow - d.getDay() + 7) % 7;
  if (add === 0) add = 7; // always the *next* occurrence
  d.setDate(d.getDate() + add);
  return d;
}

export function snoozePresets(now = new Date()): TimePreset[] {
  const presets: TimePreset[] = [];

  const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  presets.push({ label: "In 3 hours", hint: fmtTime(inThreeHours), date: inThreeHours });

  // This evening (6pm) — only if it's still meaningfully ahead.
  const evening = at(now, 18);
  if (evening.getTime() - now.getTime() > 60 * 60 * 1000) {
    presets.push({ label: "This evening", hint: fmtTime(evening), date: evening });
  }

  const tomorrow = at(new Date(now.getTime() + 24 * 60 * 60 * 1000), 8);
  presets.push({ label: "Tomorrow", hint: `${fmtDay(tomorrow)}, ${fmtTime(tomorrow)}`, date: tomorrow });

  const weekend = nextWeekday(now, 6, 8); // Saturday 8am
  if (now.getDay() !== 6 && now.getDay() !== 0) {
    presets.push({ label: "This weekend", hint: `${fmtDay(weekend)}, ${fmtTime(weekend)}`, date: weekend });
  }

  const nextWeek = nextWeekday(now, 1, 8); // Monday 8am
  presets.push({ label: "Next week", hint: `${fmtDay(nextWeek)}, ${fmtTime(nextWeek)}`, date: nextWeek });

  return presets;
}

export function sendLaterPresets(now = new Date()): TimePreset[] {
  const presets: TimePreset[] = [];

  const tonight = at(now, 20); // 8pm
  if (tonight.getTime() - now.getTime() > 30 * 60 * 1000) {
    presets.push({ label: "This evening", hint: fmtTime(tonight), date: tonight });
  }

  const tomorrow = at(new Date(now.getTime() + 24 * 60 * 60 * 1000), 8);
  presets.push({ label: "Tomorrow morning", hint: `${fmtDay(tomorrow)}, ${fmtTime(tomorrow)}`, date: tomorrow });

  const monday = nextWeekday(now, 1, 9); // Monday 9am
  presets.push({ label: "Monday morning", hint: `${fmtDay(monday)}, ${fmtTime(monday)}`, date: monday });

  return presets;
}

/** Convert a datetime-local input value (local wall time) to an ISO string. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
