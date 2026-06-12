"use client";

import { useChatDock } from "@/components/chat/ChatProvider";

/** AI quick actions on a thread — both open the assistant dock pre-seeded. */
export function ThreadAiActions({ subject, from }: { subject: string; from: string }) {
  const { openWith } = useChatDock();
  const base = `the email thread "${subject}" from ${from}`;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => openWith(`Summarize ${base}: key points, who's waiting on what, and any deadlines.`)}
        className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-1.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
        Summarize
      </button>
      <button
        onClick={() => openWith(`Draft a reply to ${base}. Show me the draft before sending anything.`)}
        className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-1.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Draft reply with AI
      </button>
    </div>
  );
}
