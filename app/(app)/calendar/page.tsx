import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  listEvents,
  listCalendars,
  eventStartMillis,
  eventEndMillis,
  isAllDay,
  type CachedEvent,
} from "@/lib/gcal";
import { NowLine } from "@/components/calendar/NowLine";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { refreshCalendar } from "./actions";

export const metadata = { title: "Calendar — ZenScail" };

const PX_PER_HOUR = 56;
type View = "day" | "week" | "month";

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const day = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - day);
  return out;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseAnchor(s?: string): Date {
  if (s) {
    const [y, m, d] = s.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return startOfDay(new Date());
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

const EVENT_COLORS = [
  { chip: "bg-[#EAEFE4] text-[#4D5C40] border-l-(--sage)" },
  { chip: "bg-[#F7ECD8] text-[#8A5F1E] border-l-(--gold)" },
  { chip: "bg-(--accent-soft) text-(--accent-deep) border-l-(--accent)" },
];

function eventColor(id: string | null | undefined, idx: number) {
  if (!id) return EVENT_COLORS[idx % 3];
  const hash = Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return EVENT_COLORS[hash % 3];
}

type Positioned = {
  event: CachedEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

function layoutDay(
  events: CachedEvent[],
  dayStart: number,
  startHour: number,
  endHour: number,
): Positioned[] {
  const windowStart = dayStart + startHour * 3600_000;
  const windowEnd = dayStart + endHour * 3600_000;
  const timed = events
    .filter((e) => !isAllDay(e))
    .map((e) => ({
      event: e,
      start: Math.max(eventStartMillis(e), windowStart),
      end: Math.min(Math.max(eventEndMillis(e), eventStartMillis(e) + 15 * 60_000), windowEnd),
    }))
    .filter((e) => e.end > windowStart && e.start < windowEnd)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: Positioned[] = [];
  let cluster: { start: number; end: number; laneEnds: number[]; items: number[] } | null = null;

  timed.forEach((item) => {
    if (!cluster || item.start >= cluster.end) {
      if (cluster) {
        for (const i of cluster.items) out[i].lanes = cluster.laneEnds.length;
      }
      cluster = { start: item.start, end: item.end, laneEnds: [], items: [] };
    }
    cluster.end = Math.max(cluster.end, item.end);
    let lane = cluster.laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = cluster.laneEnds.length;
      cluster.laneEnds.push(item.end);
    } else {
      cluster.laneEnds[lane] = item.end;
    }
    cluster.items.push(out.length);
    out.push({
      event: item.event,
      top: ((item.start - windowStart) / 3600_000) * PX_PER_HOUR,
      height: Math.max(((item.end - item.start) / 3600_000) * PX_PER_HOUR, 22),
      lane,
      lanes: 1,
    });
  });
  if (cluster) {
    const c = cluster as { laneEnds: number[]; items: number[] };
    for (const i of c.items) out[i].lanes = c.laneEnds.length;
  }
  return out;
}

type DayData = {
  date: Date;
  allDay: CachedEvent[];
  positioned: Positioned[];
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; week?: string }>;
}) {
  const { view: viewParam, date: dateParam, week } = await searchParams;
  const view: View =
    viewParam === "day" || viewParam === "month" ? viewParam : "week";

  // Anchor date — `?date=YYYY-MM-DD`, with back-compat for old `?week=offset` links.
  let anchor = parseAnchor(dateParam);
  if (!dateParam && week) {
    anchor = startOfWeek(new Date());
    anchor.setDate(anchor.getDate() + (Number(week) || 0) * 7);
  }

  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  // Compute the visible range for the active view.
  let rangeStart: Date;
  let rangeEnd: Date;
  let gridStart: Date; // month grid (Mon-first, 6 weeks)
  if (view === "day") {
    rangeStart = startOfDay(anchor);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    gridStart = rangeStart;
  } else if (view === "month") {
    const monthFirst = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    gridStart = new Date(monthFirst);
    gridStart.setDate(gridStart.getDate() - ((monthFirst.getDay() + 6) % 7));
    rangeStart = gridStart;
    rangeEnd = new Date(gridStart);
    rangeEnd.setDate(rangeEnd.getDate() + 42);
  } else {
    rangeStart = startOfWeek(anchor);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
    gridStart = rangeStart;
  }

  const [{ ok, messages: events }, calendars] = await Promise.all([
    listEvents(t, { rangeStart, rangeEnd }),
    listCalendars(t).catch(() => []),
  ]);
  if (!ok) redirect("/connect");

  const today = ymd(new Date());

  // Prev / next / today navigation hrefs.
  const shift = (delta: number): string => {
    const d = new Date(anchor);
    if (view === "day") d.setDate(d.getDate() + delta);
    else if (view === "month") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    return `/calendar?view=${view}&date=${ymd(d)}`;
  };

  // Title per view.
  const title =
    view === "day"
      ? anchor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
      : view === "month"
        ? anchor.toLocaleDateString([], { month: "long", year: "numeric" })
        : rangeStart.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
      <CalendarSidebar calendars={calendars} />
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-3xl text-(--ink)">Calendar</h1>
            <span className="text-sm font-medium text-(--muted)">{title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center overflow-hidden rounded-full border border-(--line) bg-(--paper) text-sm">
              {(["day", "week", "month"] as View[]).map((v) => (
                <Link
                  key={v}
                  href={`/calendar?view=${v}&date=${ymd(anchor)}`}
                  className={`px-3.5 py-2 font-semibold capitalize transition hover:bg-(--bg-deep) ${
                    view === v ? "bg-(--ink) text-(--bg)" : "text-(--ink-soft)"
                  }`}
                >
                  {v}
                </Link>
              ))}
            </div>
            {/* Prev / Today / Next */}
            <div className="flex items-center overflow-hidden rounded-full border border-(--line) bg-(--paper)">
              <Link href={shift(-1)} aria-label="Previous" className="px-3 py-2 text-sm text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink)">
                ←
              </Link>
              <Link href={`/calendar?view=${view}`} className="border-x border-(--line-soft) px-3.5 py-2 text-sm font-semibold text-(--ink-soft) transition hover:bg-(--bg-deep)">
                Today
              </Link>
              <Link href={shift(1)} aria-label="Next" className="px-3 py-2 text-sm text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink)">
                →
              </Link>
            </div>
            <form action={refreshCalendar}>
              <button
                title="Sync with Google Calendar"
                className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                </svg>
                Refresh
              </button>
            </form>
            <Link
              href="/calendar/links"
              className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Booking links
            </Link>
            <Link
              href="/calendar/new"
              className="flex items-center gap-1.5 rounded-full bg-(--ink) px-4 py-2 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              New event
            </Link>
          </div>
        </div>

        {view === "month" ? (
          <MonthView events={events} gridStart={gridStart} anchorMonth={anchor.getMonth()} today={today} />
        ) : (
          <TimeView events={events} rangeStart={rangeStart} days={view === "day" ? 1 : 7} today={today} />
        )}

        {events.length === 0 && (
          <p className="mt-6 text-center text-sm text-(--muted)">
            Nothing scheduled here. Hit Refresh to sync your calendar, or{" "}
            <Link href="/calendar/new" className="text-(--accent) underline">
              create an event
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

/** Day & week time grids share this component (1 or 7 columns). */
function TimeView({
  events,
  rangeStart,
  days: dayCount,
  today,
}: {
  events: CachedEvent[];
  rangeStart: Date;
  days: number;
  today: string;
}) {
  // Visible hour window: 7–20 by default, widened to fit this range's events.
  let startHour = 7;
  let endHour = 20;
  for (const e of events) {
    if (isAllDay(e)) continue;
    const s = new Date(eventStartMillis(e));
    const en = new Date(eventEndMillis(e));
    startHour = Math.min(startHour, s.getHours());
    endHour = Math.max(endHour, Math.min(en.getHours() + (en.getMinutes() > 0 ? 1 : 0), 24));
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const days: DayData[] = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(rangeStart);
    date.setDate(date.getDate() + i);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86400_000;
    const dayEvents = events.filter(
      (e) => eventEndMillis(e) > dayStart && eventStartMillis(e) < dayEnd,
    );
    return {
      date,
      allDay: dayEvents.filter(isAllDay),
      positioned: layoutDay(dayEvents, dayStart, startHour, endHour),
    };
  });

  const hasAllDay = days.some((d) => d.allDay.length > 0);
  // Static literals so Tailwind's JIT picks them up (no runtime interpolation).
  const cols = dayCount === 1 ? "grid-cols-[64px_1fr]" : "grid-cols-[64px_repeat(7,1fr)]";
  const minW = dayCount === 1 ? "min-w-0" : "min-w-210";

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      <div className={minW}>
        {/* Day headers */}
        <div className={`grid ${cols} border-b border-(--line-soft) bg-(--bg)`}>
          <div />
          {days.map(({ date }) => {
            const isToday = ymd(date) === today;
            return (
              <Link
                key={date.toISOString()}
                href={`/calendar/new?date=${ymd(date)}`}
                title="New event on this day"
                className="group border-l border-(--line-soft) px-2 py-2.5 text-center transition hover:bg-(--bg-deep)"
              >
                <div className="text-[10px] font-bold tracking-widest text-(--muted) uppercase">
                  {date.toLocaleDateString([], { weekday: "short" })}
                </div>
                <div
                  className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full font-serif text-lg ${
                    isToday ? "bg-(--accent) text-white" : "text-(--ink) group-hover:bg-(--paper)"
                  }`}
                >
                  {date.getDate()}
                </div>
              </Link>
            );
          })}
        </div>

        {/* All-day row */}
        {hasAllDay && (
          <div className={`grid ${cols} border-b border-(--line-soft)`}>
            <div className="py-1.5 pr-2 text-right text-[10px] font-semibold text-(--muted)">
              all day
            </div>
            {days.map(({ date, allDay }) => (
              <div key={date.toISOString()} className="space-y-1 border-l border-(--line-soft) p-1">
                {allDay.map((e, idx) => (
                  <Link
                    key={`${e.id}-${idx}`}
                    href={`/calendar/event/${encodeURIComponent(e.id ?? "")}`}
                    className={`block truncate rounded-md border-l-3 px-2 py-1 text-xs font-semibold transition hover:opacity-80 ${eventColor(e.id, idx).chip}`}
                  >
                    {e.summary || "(no title)"}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className={`grid ${cols}`}>
          {/* Hour gutter */}
          <div className="relative" style={{ height: hours.length * PX_PER_HOUR }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-(--muted)"
                style={{ top: i * PX_PER_HOUR }}
              >
                {i > 0 && hourLabel(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(({ date, positioned }) => {
            const isToday = ymd(date) === today;
            return (
              <div
                key={date.toISOString()}
                className={`relative border-l border-(--line-soft) ${isToday ? "bg-(--accent-soft)/25" : ""}`}
                style={{ height: hours.length * PX_PER_HOUR }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-0 left-0 border-t border-(--line-soft)"
                    style={{ top: i * PX_PER_HOUR }}
                  />
                ))}
                <Link
                  href={`/calendar/new?date=${ymd(date)}`}
                  aria-label={`New event on ${date.toDateString()}`}
                  className="absolute inset-0"
                />
                {isToday && <NowLine startHour={startHour} endHour={endHour} pxPerHour={PX_PER_HOUR} />}
                {positioned.map(({ event: e, top, height, lane, lanes }, idx) => (
                  <Link
                    key={`${e.id}-${idx}`}
                    href={`/calendar/event/${encodeURIComponent(e.id ?? "")}`}
                    className={`absolute z-10 overflow-hidden rounded-lg border-l-3 px-2 py-1 shadow-sm transition hover:z-30 hover:shadow-(--shadow-card) ${eventColor(e.id, idx).chip}`}
                    style={{
                      top,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    <div className="truncate text-xs leading-tight font-bold">
                      {e.summary || "(no title)"}
                    </div>
                    {height >= 36 && (
                      <div className="truncate text-[10px] font-semibold opacity-70">
                        {formatTime(eventStartMillis(e))} – {formatTime(eventEndMillis(e))}
                      </div>
                    )}
                    {height >= 56 && e.location && (
                      <div className="truncate text-[10px] opacity-60">{e.location}</div>
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Month grid: 6 weeks × 7 days, events as compact chips. */
function MonthView({
  events,
  gridStart,
  anchorMonth,
  today,
}: {
  events: CachedEvent[];
  gridStart: Date;
  anchorMonth: number;
  today: string;
}) {
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86400_000;
    const dayEvents = events
      .filter((e) => eventEndMillis(e) > dayStart && eventStartMillis(e) < dayEnd)
      .sort((a, b) => eventStartMillis(a) - eventStartMillis(b));
    return { date, events: dayEvents };
  });

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      <div className="grid grid-cols-7 border-b border-(--line-soft) bg-(--bg)">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-bold tracking-widest text-(--muted) uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, events: dayEvents }, i) => {
          const inMonth = date.getMonth() === anchorMonth;
          const isToday = ymd(date) === today;
          return (
            <div
              key={i}
              className={`min-h-26 border-t border-l border-(--line-soft) p-1.5 ${
                i % 7 === 0 ? "border-l-0" : ""
              } ${inMonth ? "" : "bg-(--bg)/40"}`}
            >
              <Link
                href={`/calendar?view=day&date=${ymd(date)}`}
                className="flex items-center justify-end"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition hover:bg-(--bg-deep) ${
                    isToday ? "bg-(--accent) text-white" : inMonth ? "text-(--ink-soft)" : "text-(--muted)/60"
                  }`}
                >
                  {date.getDate()}
                </span>
              </Link>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <Link
                    key={`${e.id}-${idx}`}
                    href={`/calendar/event/${encodeURIComponent(e.id ?? "")}`}
                    className={`block truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] font-medium transition hover:opacity-80 ${eventColor(e.id, idx).chip}`}
                  >
                    {!isAllDay(e) && (
                      <span className="font-semibold opacity-70">{formatTime(eventStartMillis(e))} </span>
                    )}
                    {e.summary || "(no title)"}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <Link
                    href={`/calendar?view=day&date=${ymd(date)}`}
                    className="block px-1.5 text-[10px] font-semibold text-(--muted) hover:text-(--ink)"
                  >
                    +{dayEvents.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
