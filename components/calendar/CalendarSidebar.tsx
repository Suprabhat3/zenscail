"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CalendarSummary } from "@/lib/gcal";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYmd(s: string | null): Date {
  if (s) {
    const [y, m, d] = s.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

// Calendar list swatch palette (purely decorative — we can't toggle per-calendar
// fetches, so these are shown for parity/orientation).
const SWATCHES = ["bg-(--accent)", "bg-(--sage)", "bg-(--gold)", "bg-[#7C9CB8]", "bg-[#B88A9C]"];

export function CalendarSidebar({ calendars }: { calendars: CalendarSummary[] }) {
  const params = useSearchParams();
  const view = params.get("view") ?? "week";
  const selected = parseYmd(params.get("date"));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Mini-month grid anchored on the selected date's month (Mon-first).
  const monthFirst = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const gridStart = new Date(monthFirst);
  gridStart.setDate(gridStart.getDate() - ((monthFirst.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prevMonth = new Date(selected.getFullYear(), selected.getMonth() - 1, 1);
  const nextMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
  const dayHref = (d: Date) => `/calendar?view=${view}&date=${ymd(d)}`;

  const list = calendars.length > 0 ? calendars : [{ id: "primary", summary: "Primary" }];

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <Link
        href="/calendar/new"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-(--ink) px-4 py-2.5 text-sm font-semibold text-(--bg) shadow-(--shadow-card) transition hover:bg-(--accent)"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        New event
      </Link>

      {/* Mini month */}
      <div className="rounded-2xl border border-(--line-soft) bg-(--paper) p-3 shadow-(--shadow-card)">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="font-serif text-sm text-(--ink)">
            {selected.toLocaleDateString([], { month: "long", year: "numeric" })}
          </span>
          <span className="flex items-center gap-0.5">
            <Link
              href={`/calendar?view=${view}&date=${ymd(prevMonth)}`}
              aria-label="Previous month"
              className="flex h-6 w-6 items-center justify-center rounded-full text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
            >
              ‹
            </Link>
            <Link
              href={`/calendar?view=${view}&date=${ymd(nextMonth)}`}
              aria-label="Next month"
              className="flex h-6 w-6 items-center justify-center rounded-full text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
            >
              ›
            </Link>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[10px] font-bold text-(--muted)">
              {d}
            </span>
          ))}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === selected.getMonth();
            const isToday = ymd(d) === ymd(today);
            const isSelected = ymd(d) === ymd(selected);
            return (
              <Link
                key={i}
                href={dayHref(d)}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${
                  isSelected
                    ? "bg-(--accent) font-bold text-white"
                    : isToday
                      ? "font-bold text-(--accent)"
                      : inMonth
                        ? "text-(--ink-soft) hover:bg-(--bg-deep)"
                        : "text-(--muted)/50 hover:bg-(--bg-deep)"
                }`}
              >
                {d.getDate()}
              </Link>
            );
          })}
        </div>
      </div>

      {/* My calendars */}
      <div className="mt-5">
        <p className="px-1 pb-1.5 text-[11px] font-bold tracking-widest text-(--muted) uppercase">
          My calendars
        </p>
        <ul className="space-y-0.5">
          {list.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-(--ink-soft)"
            >
              <span className={`h-3 w-3 shrink-0 rounded-sm ${SWATCHES[i % SWATCHES.length]}`} />
              <span className="truncate">{c.summary}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
