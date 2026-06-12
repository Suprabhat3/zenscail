import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  listEvents,
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

// Deterministic color per event based on id hash
const EVENT_COLORS = [
  { bg: "bg-[#EAEFE4]", text: "text-[#4D5C40]", bar: "border-l-[3px] border-l-[var(--sage)]" },
  { bg: "bg-[#F7ECD8]", text: "text-[#8A5F1E]", bar: "border-l-[3px] border-l-[var(--gold)]" },
  { bg: "bg-(--accent-soft)", text: "text-(--accent-deep)", bar: "border-l-[3px] border-l-[var(--accent)]" },
];

function eventColor(id: string | null | undefined, idx: number) {
  if (!id) return EVENT_COLORS[idx % 3];
  const hash = Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return EVENT_COLORS[hash % 3];
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

  const { ok, messages: events } = await listEvents(t, {
    rangeStart: weekStart,
    rangeEnd: weekEnd,
  });
  if (!ok) redirect("/connect");

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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl font-normal tracking-tight text-(--ink)">Calendar</h1>
          <span className="text-sm text-(--muted)">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?week=${weekOffset - 1}`}
              className="rounded-full border border-(--line) px-3 py-1.5 text-sm text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              ←
            </Link>
            <Link
              href="/calendar"
              className="rounded-full border border-(--line) px-3 py-1.5 text-sm text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              Today
            </Link>
            <Link
              href={`/calendar?week=${weekOffset + 1}`}
              className="rounded-full border border-(--line) px-3 py-1.5 text-sm text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              →
            </Link>
          </div>
          <form action={refreshCalendar}>
            <button className="rounded-full border border-(--line) px-3 py-1.5 text-sm text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)">
              Refresh
            </button>
          </form>
          <Link
            href="/calendar/new"
            className="rounded-full bg-(--ink) px-4 py-1.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
          >
            New event
          </Link>
        </div>
      </div>

      {/* Week grid */}
      <div className="mt-6 grid grid-cols-7 gap-2">
        {days.map(({ date, events: dayEvents }) => {
          const isToday = ymd(date) === today;
          return (
            <div
              key={date.toISOString()}
              className={`min-h-48 rounded-2xl border bg-(--paper) p-2 transition ${
                isToday
                  ? "border-(--accent)/50 shadow-[0_0_0_2px_var(--accent-soft)]"
                  : "border-(--line-soft)"
              }`}
            >
              <Link
                href={`/calendar/new?date=${ymd(date)}`}
                className="block rounded-lg px-1 py-0.5 transition hover:bg-(--bg-deep)"
                title="New event on this day"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-(--muted)">
                  {date.toLocaleDateString([], { weekday: "short" })}
                </div>
                <div
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday
                      ? "bg-(--accent) text-white"
                      : "text-(--ink)"
                  }`}
                >
                  {date.getDate()}
                </div>
              </Link>
              <ul className="mt-1.5 space-y-1">
                {dayEvents.map((e: CachedEvent, idx: number) => {
                  const color = eventColor(e.id, idx);
                  return (
                    <li key={`${e.id}-${e.start?.dateTime ?? e.start?.date}`}>
                      <Link
                        href={`/calendar/event/${encodeURIComponent(e.id ?? "")}`}
                        className={`block rounded-lg px-2 py-1 text-xs transition hover:opacity-80 ${color.bg} ${color.text} ${color.bar}`}
                      >
                        {!isAllDay(e) && (
                          <div className="mb-0.5 text-[10px] font-semibold opacity-70">
                            {formatTime(eventStartMillis(e))}
                          </div>
                        )}
                        <div className="truncate font-semibold leading-snug">
                          {e.summary || "(no title)"}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <p className="mt-8 text-center text-sm text-(--muted)">
          No events this week. Hit Refresh to sync your calendar, or{" "}
          <Link href="/calendar/new" className="text-(--accent) underline">
            create one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
