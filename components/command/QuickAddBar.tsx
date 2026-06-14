"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChatDock } from "@/components/chat/ChatProvider";
import { useToast } from "@/components/ui/Toast";
import {
  quickAdd,
  createQuickEvent,
  type QuickAddIntent,
} from "@/app/(app)/quick-add/actions";

type EventPending = Extract<QuickAddIntent, { kind: "event" }>;

// Productive-looking progress steps shown while the (4–10s) parse is in flight.
// We can't stream the real intent, so we advance through these on a timer to
// reassure the user that work is happening.
const STEPS = [
  "Understanding your request…",
  "Checking your inbox & calendar…",
  "Finding the right people…",
  "Putting it together…",
  "Almost there…",
];

function whenLabel(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const date = s.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const st = s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const et = e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${date}, ${st}–${et}`;
}

/**
 * Natural-language quick-add bar in the app header. One line of text is parsed
 * by `quickAdd` into an event / email / search / agent intent. Writes (events)
 * ask for a one-line confirmation first; everything else hands off immediately.
 */
export function QuickAddBar() {
  const router = useRouter();
  const { openWith } = useChatDock();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState<EventPending | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Advance the progress steps while a request is in flight; stop on the last.
  useEffect(() => {
    if (!busy) {
      setStep(0);
      return;
    }
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1700);
    return () => clearInterval(id);
  }, [busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setPending(null);
    try {
      const intent = await quickAdd(value);
      switch (intent.kind) {
        case "event":
          setPending(intent);
          break;
        case "email": {
          const params = new URLSearchParams();
          if (intent.to) params.set("to", intent.to);
          if (intent.subject) params.set("subject", intent.subject);
          if (intent.body) params.set("body", intent.body);
          setText("");
          router.push(`/mail/compose?${params.toString()}`);
          break;
        }
        case "search":
          setText("");
          router.push(`/mail?q=${encodeURIComponent(intent.query)}`);
          break;
        case "agent":
          setText("");
          openWith(intent.text);
          break;
      }
    } catch {
      toast("Couldn't parse that — try the assistant instead.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEvent() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await createQuickEvent({
        summary: pending.summary,
        startIso: pending.startIso,
        endIso: pending.endIso,
        attendees: pending.attendees,
      });
      if (res.ok) {
        toast(`Event created: ${pending.summary}`, {
          action: { label: "View", onClick: () => router.push("/calendar") },
        });
        setPending(null);
        setText("");
        router.refresh();
      } else {
        toast("Couldn't create the event.");
      }
    } finally {
      setBusy(false);
    }
  }

  function openInCalendar() {
    if (!pending) return;
    const date = pending.startIso.slice(0, 10);
    setPending(null);
    setText("");
    router.push(`/calendar/new?date=${date}&summary=${encodeURIComponent(pending.summary)}`);
  }

  return (
    <div className="relative hidden min-w-0 flex-1 justify-center px-4 md:flex">
      <form onSubmit={submit} className="w-full max-w-md">
        <div className="relative">
          <svg
            className={`pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 ${busy ? "animate-pulse text-(--accent-deep)" : "text-(--muted)"}`}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
          </svg>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPending(null);
            }}
            disabled={busy}
            placeholder="Try “lunch with Sam tomorrow 1pm” or “email Dana the deck is ready”"
            className="w-full truncate rounded-full border border-(--line) bg-(--paper) py-2 pr-11 pl-9 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft) disabled:opacity-0"
          />

          {/* Send button (Enter also works on desktop) */}
          {!busy && (
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Run"
              title="Run"
              className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-(--ink) text-(--bg) transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}

          {/* In-flight progress: cycling status over the bar so it never looks stuck */}
          {busy && (
            <div className="absolute inset-0 flex items-center gap-2.5 rounded-full border border-(--accent)/40 bg-(--accent-soft) pr-3 pl-9">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--accent-deep)">
                {STEPS[step]}
              </span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--accent-deep) [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--accent-deep) [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--accent-deep)" />
              </span>
            </div>
          )}
        </div>
      </form>

      {pending && (
        <div className="absolute top-full left-1/2 z-50 mt-2 w-88 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-(--line) bg-(--paper) shadow-2xl">
          <div className="border-b border-(--line-soft) px-4 py-3">
            <p className="text-[11px] font-bold tracking-widest text-(--accent) uppercase">
              Create event?
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-(--ink)">{pending.summary}</p>
            <p className="mt-0.5 text-xs text-(--ink-soft)">
              {whenLabel(pending.startIso, pending.endIso)}
            </p>
            {pending.attendees.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-(--muted)">
                With {pending.attendees.join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={confirmEvent}
              disabled={busy}
              className="rounded-full bg-(--ink) px-4 py-2 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={openInCalendar}
              className="rounded-full border border-(--line) px-3.5 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              Edit details
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="ml-auto rounded-full px-2 py-2 text-sm text-(--muted) transition hover:text-(--ink)"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
