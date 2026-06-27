"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChatDock } from "@/components/chat/ChatProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { generateBriefAction } from "@/app/(app)/dashboard/actions";

/** "Ask about this brief" — opens the chat dock seeded with a prompt. */
export function AskBriefButton() {
  const { openWith } = useChatDock();
  return (
    <button
      onClick={() =>
        openWith("Walk me through today's brief — what should I tackle first, and why?")
      }
      className="inline-flex items-center gap-2 rounded-full bg-(--ink) px-4 py-2 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      Ask about this brief
    </button>
  );
}

/** Per-action-item "Ask AI" chip — seeds the chat with that item's context. */
export function AskItemButton({ title, subject, from }: { title: string; subject?: string; from?: string }) {
  const { openWith } = useChatDock();
  return (
    <button
      onClick={() =>
        openWith(
          subject
            ? `Help me with this: "${title}". It's about the email "${subject}" from ${from ?? "unknown"}. Show me the key details and suggest what to do.`
            : `Help me with this task from my brief: "${title}". What's the best way to handle it?`,
        )
      }
      className="rounded-full border border-(--line) px-3 py-1 text-xs font-semibold text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
    >
      Ask AI
    </button>
  );
}

/** Regenerate today's brief in place. */
export function RefreshBriefButton() {
  const router = useRouter();
  const { active: demo, requireLogin } = useDemo();
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (demo) {
          requireLogin("Sign in to regenerate your brief from your live mail and calendar.");
          return;
        }
        startTransition(async () => {
          await generateBriefAction();
          router.refresh();
        });
      }}
      title="Regenerate with the latest mail and events"
      className="inline-flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-2 text-xs font-semibold text-(--ink-soft) transition hover:border-(--ink) disabled:opacity-50"
    >
      <svg
        className={pending ? "animate-spin" : ""}
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
      </svg>
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
