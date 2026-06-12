import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  searchCachedEvents,
  refreshEvents,
  eventStartMillis,
  eventEndMillis,
  isAllDay,
  type CachedEvent,
} from "@/lib/gcal";
import { refreshCalendar } from "./actions";

export const metadata = { title: "Calendar — ZenScail" };

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - day);
  return out;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekOffset = Number(week) || 0;
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const weekStart = startOfWeek(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let events = await searchCachedEvents(t, { rangeStart: weekStart, rangeEnd: weekEnd });

  // Empty cache on first visit: try one refresh; if Calendar isn't connected
  // yet this is where we find out and route to /connect.
  if (events.length === 0) {
    const refreshed = await refreshEvents(t, {
      timeMin: new Date(weekStart.getTime() - 30 * 86400_000),
      timeMax: new Date(weekEnd.getTime() + 90 * 86400_000),
    });
    if (!refreshed.success) redirect("/connect");
    events = await searchCachedEvents(t, { rangeStart: weekStart, rangeEnd: weekEnd });
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86400_000;
    const dayEvents = events.filter(
      (e) => eventEndMillis(e) > dayStart && eventStartMillis(e) < dayEnd,
    );
    return { date, events: dayEvents };
  });

  const today = ymd(new Date());
  const monthLabel = weekStart.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-2xl">Calendar</h1>
          <span className="text-sm text-neutral-400">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?week=${weekOffset - 1}`}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              ←
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Today
            </Link>
            <Link
              href={`/calendar?week=${weekOffset + 1}`}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              →
            </Link>
          </div>
          <form action={refreshCalendar}>
            <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
              Refresh
            </button>
          </form>
          <Link
            href="/calendar/new"
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-white"
          >
            New event
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2">
        {days.map(({ date, events: dayEvents }) => {
          const isToday = ymd(date) === today;
          return (
            <div
              key={date.toISOString()}
              className={`min-h-48 rounded-xl border bg-neutral-900 p-2 ${
                isToday ? "border-neutral-500" : "border-neutral-800"
              }`}
            >
              <Link
                href={`/calendar/new?date=${ymd(date)}`}
                className="block rounded-lg px-1 py-0.5 hover:bg-neutral-800"
                title="New event on this day"
              >
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  {date.toLocaleDateString([], { weekday: "short" })}
                </div>
                <div className={`text-lg ${isToday ? "font-semibold text-neutral-50" : "text-neutral-300"}`}>
                  {date.getDate()}
                </div>
              </Link>
              <ul className="mt-2 space-y-1">
                {dayEvents.map((e: CachedEvent) => (
                  <li key={`${e.id}-${e.start?.dateTime ?? e.start?.date}`}>
                    <Link
                      href={`/calendar/event/${encodeURIComponent(e.id ?? "")}`}
                      className="block rounded-lg border border-neutral-700/60 bg-neutral-800/60 px-2 py-1 hover:bg-neutral-700/60"
                    >
                      {!isAllDay(e) && (
                        <div className="text-[10px] text-neutral-400">
                          {formatTime(eventStartMillis(e))}
                        </div>
                      )}
                      <div className="truncate text-xs text-neutral-200">
                        {e.summary || "(no title)"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <p className="mt-8 text-center text-sm text-neutral-500">
          No events this week. Hit Refresh to sync your calendar, or create one.
        </p>
      )}
    </div>
  );
}
