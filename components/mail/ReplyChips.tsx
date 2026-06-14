"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { suggestReplies, type ReplySuggestion } from "@/app/(app)/mail/thread/[id]/suggest";

const REPLY_BODY_ID = "reply-body";

/** Set the reply textarea's value (uncontrolled) + focus it, dispatching input
 * so any listeners (and the browser's required-field state) stay in sync. */
function fillReply(draft: string) {
  const el = document.getElementById(REPLY_BODY_ID) as HTMLTextAreaElement | null;
  if (!el) return;
  el.value = draft;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  el.setSelectionRange(draft.length, draft.length);
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Instant AI reply chips for a thread. Generates 3 short suggestions lazily
 * (on first reveal, not on thread open, so opening a thread stays instant);
 * tapping a chip pre-fills the reply box for editing — never auto-sends.
 * Keys 1/2/3 select chips once loaded.
 */
export function ReplyChips({ threadId }: { threadId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [chips, setChips] = useState<ReplySuggestion[]>([]);
  const fetched = useRef(false);

  const load = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setState("loading");
    try {
      const res = await suggestReplies(threadId);
      if (res.length > 0) {
        setChips(res);
        setState("ready");
      } else {
        setState("empty");
      }
    } catch {
      setState("empty");
    }
  }, [threadId]);

  useEffect(() => {
    if (state !== "ready") return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      const n = Number(e.key);
      if (n >= 1 && n <= chips.length) {
        e.preventDefault();
        fillReply(chips[n - 1].draft);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, chips]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          Quick replies
        </span>
        {state === "idle" && (
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-(--line) px-3 py-1 text-xs font-medium text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
          >
            Suggest replies
          </button>
        )}
        {state === "loading" && (
          <span className="text-xs text-(--muted)">Thinking…</span>
        )}
        {state === "empty" && (
          <span className="text-xs text-(--muted)">No suggestions right now.</span>
        )}
      </div>

      {state === "ready" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => fillReply(c.draft)}
              title={c.draft}
              className="group flex max-w-full items-center gap-2 rounded-full border border-(--line) bg-(--paper) py-1.5 pr-4 pl-2.5 text-sm text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--bg) text-[11px] font-bold text-(--muted) group-hover:bg-(--accent) group-hover:text-(--paper)">
                {i + 1}
              </span>
              <span className="truncate">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
