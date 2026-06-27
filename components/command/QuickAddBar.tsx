"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChatDock } from "@/components/chat/ChatProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { useToast } from "@/components/ui/Toast";
import { MicButton } from "@/components/voice/MicButton";
import { runQuickCommand } from "@/app/(app)/quick-add/actions";

// Productive-looking progress steps shown while the agent works (it finds the
// person/thread, drafts the email/event, then hands off a ready-to-review
// screen). We can't stream the real steps here, so we advance on a timer.
const STEPS = [
  "Understanding your request…",
  "Checking your inbox & calendar…",
  "Finding the right people…",
  "Drafting it for you…",
  "Almost there…",
];

/**
 * Natural-language quick-add bar in the app header. One line is handed to the
 * shared assistant agent (`runQuickCommand`), which finds the right contact /
 * thread, writes the full email or builds the event, then returns a pre-filled
 * compose / new-event / search page to open. The user reviews and clicks
 * Send / Create — we never send or create on their behalf. Anything that needs
 * a back-and-forth is handed to the assistant dock. Every command is saved to
 * the same history as the dock.
 */
export function QuickAddBar() {
  const router = useRouter();
  const { openWith } = useChatDock();
  const { active: demo, requireLogin } = useDemo();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
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
    if (demo) {
      requireLogin("Sign in and the assistant will carry this out — drafting emails and building events for you.");
      return;
    }
    setBusy(true);
    try {
      const result = await runQuickCommand(value);
      setText("");
      if (result.kind === "navigate") {
        if (result.label) toast(result.label);
        router.push(result.url);
      } else {
        // Needs a conversation — open the assistant with the original command
        // so it carries the request out in a streamed back-and-forth.
        openWith(value);
      }
    } catch {
      toast("Couldn't do that — try the assistant instead.");
      openWith(value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative hidden min-w-0 flex-1 justify-center px-4 md:flex">
      <form onSubmit={submit} className="flex w-full max-w-md items-center gap-2">
        <div className="relative flex-1">
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
            disabled={busy}
            placeholder="Try “draft an email to Dana that the deck is ready” or “lunch with Sam tomorrow 1pm”"
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
        <MicButton
          size="sm"
          disabled={busy}
          title="Speak a command"
          onText={(t) => {
            setText((p) => (p ? `${p.trimEnd()} ` : "") + t);
            inputRef.current?.focus();
          }}
          onError={toast}
        />
      </form>
    </div>
  );
}
