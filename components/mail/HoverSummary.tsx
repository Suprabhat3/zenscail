"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getEmailSummary } from "@/app/(app)/mail/summary-actions";
import type { EmailSummaryData } from "@/lib/ai/summary";

// Per-session cache so re-hovering a row never re-fetches. `null` = no summary.
const cache = new Map<string, EmailSummaryData | null>();

const OPEN_DELAY = 350; // ms — only fire for a deliberate hover, not a quick scan
const CARD_WIDTH = 344;

type Status = "loading" | "ready" | "empty";
type Pos = { top: number; left: number; placement: "below" | "above" };

/**
 * Inbox-row hover summary. Mounted inside a MessageRow's <li>; it senses hover
 * on the whole row, then (after a short delay) shows a floating AI summary card.
 * Summaries are generated once and cached in the DB — the first hover on an
 * un-summarized email lazily generates it; everything after is instant.
 *
 * The card is a portal (the list containers clip overflow) and read-only
 * (pointer-events: none) so the row's own hover state cleanly governs it.
 */
export function HoverSummary({ messageId }: { messageId: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetched = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<EmailSummaryData | null>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    if (cache.has(messageId)) {
      const cached = cache.get(messageId) ?? null;
      setData(cached);
      setStatus(cached ? "ready" : "empty");
      return;
    }
    if (fetched.current) return;
    fetched.current = true;
    setStatus("loading");
    try {
      const res = await getEmailSummary(messageId);
      cache.set(messageId, res);
      setData(res);
      setStatus(res ? "ready" : "empty");
    } catch {
      cache.set(messageId, null);
      setStatus("empty");
    }
  }, [messageId]);

  useEffect(() => {
    const li = anchorRef.current?.closest("li");
    if (!li) return;

    function place() {
      const rect = li!.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(rect.left + 48, window.innerWidth - CARD_WIDTH - margin),
      );
      const below = rect.bottom + margin;
      // Flip above the row if there isn't comfortable room beneath it.
      const placement: Pos["placement"] =
        below + 220 > window.innerHeight && rect.top > 240 ? "above" : "below";
      setPos({
        top: placement === "below" ? below : rect.top - margin,
        left,
        placement,
      });
    }

    function onEnter() {
      if (openTimer.current) clearTimeout(openTimer.current);
      openTimer.current = setTimeout(() => {
        place();
        setOpen(true);
        void load();
      }, OPEN_DELAY);
    }
    function onLeave() {
      if (openTimer.current) clearTimeout(openTimer.current);
      setOpen(false);
    }

    li.addEventListener("mouseenter", onEnter);
    li.addEventListener("mouseleave", onLeave);
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      li.removeEventListener("mouseenter", onEnter);
      li.removeEventListener("mouseleave", onLeave);
    };
  }, [load]);

  // Don't leave a stale card hanging over the page when the row scrolls away.
  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <span ref={anchorRef} className="hidden" aria-hidden>
      {mounted && open && pos
        ? createPortal(
            <SummaryCard pos={pos} status={status} data={data} />,
            document.body,
          )
        : null}
    </span>
  );
}

function SummaryCard({
  pos,
  status,
  data,
}: {
  pos: Pos;
  status: Status;
  data: EmailSummaryData | null;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        top: pos.top,
        left: pos.left,
        width: CARD_WIDTH,
        transform: pos.placement === "above" ? "translateY(-100%)" : undefined,
      }}
    >
      <div className="zs-hover-summary overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-float)">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-(--line-soft) bg-(--accent-soft)/40 px-4 py-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-(--accent)" aria-hidden>
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span className="text-[11px] font-bold tracking-widest text-(--accent-deep) uppercase">
            AI Summary
          </span>
        </div>

        <div className="px-4 py-3.5">
          {status === "loading" && <SummarySkeleton />}

          {status === "empty" && (
            <p className="text-sm text-(--muted)">No summary available for this email yet.</p>
          )}

          {status === "ready" && data && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-2.5">
      <div className="h-3.5 w-full rounded bg-(--line-soft)" />
      <div className="h-3.5 w-4/5 rounded bg-(--line-soft)" />
      <div className="mt-3 h-3 w-3/5 rounded bg-(--line-soft)" />
      <div className="h-3 w-2/3 rounded bg-(--line-soft)" />
    </div>
  );
}
