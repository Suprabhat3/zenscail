"use client";

import { useChatDock } from "./ChatProvider";

/** Header toggle for the chat dock — visible on every app page. */
export function ChatLauncher() {
  const { open, toggle } = useChatDock();

  return (
    <button
      onClick={toggle}
      aria-pressed={open}
      aria-label={open ? "Close assistant" : "Open assistant"}
      className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm font-semibold transition sm:px-3.5 ${
        open
          ? "border-(--accent) bg-(--accent) text-white"
          : "border-(--line) bg-(--paper) text-(--ink-soft) hover:border-(--accent) hover:text-(--accent-deep)"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      <span className="hidden sm:inline">Assistant</span>
    </button>
  );
}
