"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { snoozeThread } from "@/app/(app)/mail/schedule-actions";
import { useToast } from "@/components/ui/Toast";
import { snoozePresets, fmtDateTime, localInputToIso } from "@/lib/timePresets";

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function SnoozeMenu({
  threadId,
  variant = "button",
}: {
  threadId: string;
  variant?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function doSnooze(date: Date) {
    setOpen(false);
    startTransition(async () => {
      try {
        await snoozeThread(threadId, date.toISOString());
        toast(`Snoozed until ${fmtDateTime(date)}`);
      } catch {
        toast("Couldn't snooze this thread");
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-row-action="snooze"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={pending}
        title="Snooze"
        aria-label="Snooze"
        className={
          variant === "icon"
            ? "flex h-7 w-7 items-center justify-center rounded-full text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink) disabled:opacity-50"
            : "flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-1.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink) disabled:opacity-50"
        }
      >
        <ClockIcon />
        {variant === "button" && "Snooze"}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-(--line) bg-(--paper) py-1.5 shadow-(--shadow-float)">
          <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
            Snooze until
          </p>
          {snoozePresets().map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => doSnooze(p.date)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-(--ink) transition hover:bg-(--bg)"
            >
              <span>{p.label}</span>
              <span className="text-xs text-(--muted)">{p.hint}</span>
            </button>
          ))}
          <div className="mt-1 border-t border-(--line-soft) px-3 pt-2 pb-1">
            <label className="block text-[11px] font-semibold text-(--muted)">
              Custom
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="datetime-local"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-(--line) bg-(--bg) px-2 py-1 text-xs text-(--ink) focus:border-(--accent) focus:outline-none"
              />
              <button
                type="button"
                disabled={!custom}
                onClick={() => {
                  const iso = localInputToIso(custom);
                  if (iso) doSnooze(new Date(iso));
                }}
                className="shrink-0 rounded-lg bg-(--ink) px-2.5 py-1 text-xs font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-40"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
