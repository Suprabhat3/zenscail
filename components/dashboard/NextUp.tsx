"use client";

import Link from "next/link";
import type { BriefEvent } from "@/lib/ai/brief";
import { useNow } from "./useNow";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "in 22 min" / "in 1 hr 5 min" / "starting now". */
function countdown(ms: number): string {
  if (ms <= 0) return "starting now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h} hr ${m} min` : `in ${h} hr`;
}

/**
 * Pins the next upcoming (or in-progress) timed meeting with a live countdown
 * and a one-click Join for video calls. Renders nothing when nothing's next.
 */
export function NextUp({ events }: { events: BriefEvent[] }) {
  const now = useNow();

  if (now === 0) return null; // not ready (server / first client render)

  const next = events
    .filter((e) => !e.allDay && e.end && Date.parse(e.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!next) return null;

  const start = Date.parse(next.start);
  const live = start <= now;

  return (
    <section className="rounded-2xl border border-(--accent) bg-(--accent-soft) p-5 shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-bold tracking-widest text-(--accent-deep) uppercase">
          {live ? "Happening now" : "Next up"}
        </p>
        <span className="rounded-full bg-(--bg)/70 px-2 py-0.5 text-xs font-bold text-(--accent-deep)">
          {live ? "Now" : countdown(start - now)}
        </span>
      </div>
      <Link
        href={next.id ? `/calendar/event/${next.id}` : "/calendar"}
        className="mt-2 block"
      >
        <p className="truncate font-serif text-lg text-(--ink) hover:text-(--accent-deep)">
          {next.summary}
        </p>
      </Link>
      <p className="mt-0.5 text-xs text-(--ink-soft)">
        {fmtTime(next.start)} – {fmtTime(next.end)}
        {next.location ? ` · ${next.location}` : ""}
        {next.attendeeCount > 1 ? ` · ${next.attendeeCount} people` : ""}
      </p>
      {next.hangoutLink && (
        <a
          href={next.hangoutLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-(--ink) px-4 py-2 text-xs font-semibold text-(--bg) transition hover:bg-(--accent)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m23 7-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Join meeting →
        </a>
      )}
    </section>
  );
}
