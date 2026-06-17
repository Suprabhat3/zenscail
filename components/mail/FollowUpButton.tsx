"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFollowUp, clearFollowUp } from "@/app/(app)/mail/follow-up-actions";
import { useToast } from "@/components/ui/Toast";

const PRESETS: { label: string; days: number }[] = [
  { label: "In 1 day", days: 1 },
  { label: "In 2 days", days: 2 },
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
];

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/**
 * "Remind me if no reply" on a thread. If a follow-up is already armed, shows
 * its due date and a one-click clear; otherwise opens a day-preset menu.
 */
export function FollowUpButton({
  threadId,
  active,
}: {
  threadId: string;
  active: { status: string; remindAt: string } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const armed = active?.status === "waiting";

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

  function arm(days: number) {
    setOpen(false);
    startTransition(async () => {
      try {
        await createFollowUp(threadId, days);
        toast(`Follow-up set — we'll remind you in ${days} day${days === 1 ? "" : "s"}`);
        router.refresh();
      } catch {
        toast("Couldn't set a follow-up");
      }
    });
  }

  function clear() {
    startTransition(async () => {
      try {
        await clearFollowUp(threadId);
        toast("Follow-up cleared");
        router.refresh();
      } catch {
        toast("Couldn't clear the follow-up");
      }
    });
  }

  if (armed && active) {
    const due = new Date(active.remindAt);
    return (
      <button
        type="button"
        onClick={clear}
        disabled={pending}
        title="Clear follow-up"
        className="flex items-center gap-1.5 rounded-full border border-(--accent) bg-(--accent-soft) px-3.5 py-1.5 text-sm font-medium text-(--accent-deep) transition hover:bg-(--accent) hover:text-(--paper) disabled:opacity-50"
      >
        <BellIcon />
        Following up {fmtDay(due)}
        <span className="opacity-60">·</span>
        <span className="text-xs">clear</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        title="Remind me if no reply"
        className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-1.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink) disabled:opacity-50"
      >
        <BellIcon />
        Follow up
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-(--line) bg-(--paper) py-1.5 shadow-(--shadow-float)">
          <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
            Remind me if no reply
          </p>
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => arm(p.days)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-(--ink) transition hover:bg-(--bg)"
            >
              <span>{p.label}</span>
              <span className="text-xs text-(--muted)">
                {fmtDay(new Date(Date.now() + p.days * 86400000))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
