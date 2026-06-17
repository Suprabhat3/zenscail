"use client";

import { useState } from "react";
import type { EmailSummaryData } from "@/lib/ai/summary";

/**
 * Persistent "at a glance" summary shown at the top of an opened thread. Reuses
 * the summary we already generated for the inbox hover card (keyed by the gmail
 * message id), so opening an email costs nothing extra — the reader gets the
 * tldr, key points, and the one action before scrolling into the full message.
 *
 * Collapsible (expanded by default) so it stays out of the way once read.
 */
export function SummaryBanner({ data }: { data: EmailSummaryData }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      {/* Header — click to collapse/expand */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 border-b border-(--line-soft) bg-(--accent-soft)/40 px-4 py-2.5 text-left transition hover:bg-(--accent-soft)/60"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-(--accent)" aria-hidden>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
        <span className="text-[11px] font-bold tracking-widest text-(--accent-deep) uppercase">
          AI Summary
        </span>
        <svg
          className="ml-auto shrink-0 text-(--accent-deep) transition-transform"
          style={{ transform: open ? undefined : "rotate(-90deg)" }}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-3.5">
          <p className="text-sm leading-relaxed font-medium text-(--ink)">{data.tldr}</p>

          {data.bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {data.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-snug text-(--ink-soft)">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-(--accent)" aria-hidden />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
          )}

          {data.action && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-(--accent-soft) px-3 py-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-(--accent-deep)" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <span className="text-[13px] leading-snug font-semibold text-(--accent-deep)">
                {data.action}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
