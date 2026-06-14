"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChatDock } from "@/components/chat/ChatProvider";
import { clearFollowUp } from "@/app/(app)/mail/follow-up-actions";
import { useToast } from "@/components/ui/Toast";

export type SurfacedFollowUp = {
  threadId: string;
  subject: string | null;
  contact: string | null;
};

/**
 * Inbox banner for threads that are waiting on a reply past their reminder
 * time. Each offers a one-click AI nudge (hands the thread to the chat agent)
 * and a dismiss. Renders nothing when there's nothing to surface.
 */
export function FollowUpBanner({ items }: { items: SurfacedFollowUp[] }) {
  const router = useRouter();
  const { openWith } = useChatDock();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = items.filter((i) => !dismissed.has(i.threadId));
  if (visible.length === 0) return null;

  function nudge(item: SurfacedFollowUp) {
    openWith(
      `Draft a short, friendly follow-up nudge for the email thread "${item.subject ?? "(no subject)"}"${
        item.contact ? ` with ${item.contact}` : ""
      }. They haven't replied yet. Show me the draft before sending anything.`,
    );
  }

  function dismiss(threadId: string) {
    setDismissed((prev) => new Set(prev).add(threadId));
    startTransition(async () => {
      try {
        await clearFollowUp(threadId);
        router.refresh();
      } catch {
        toast("Couldn't dismiss the follow-up");
      }
    });
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-(--accent)/40 bg-(--accent-soft) shadow-(--shadow-card)">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-(--accent-deep)" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <p className="text-sm font-semibold text-(--accent-deep)">
          {visible.length} thread{visible.length === 1 ? "" : "s"} waiting on a reply
        </p>
      </div>
      <ul className="divide-y divide-(--accent)/15 border-t border-(--accent)/20">
        {visible.map((item) => (
          <li key={item.threadId} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <Link
              href={`/mail/thread/${item.threadId}`}
              className="min-w-0 flex-1 transition hover:opacity-80"
            >
              <p className="truncate text-sm font-medium text-(--ink)">
                {item.subject || "(no subject)"}
              </p>
              {item.contact && (
                <p className="truncate text-xs text-(--ink-soft)">No reply from {item.contact}</p>
              )}
            </Link>
            <button
              type="button"
              onClick={() => nudge(item)}
              className="shrink-0 rounded-full bg-(--ink) px-3 py-1.5 text-xs font-semibold text-(--bg) transition hover:bg-(--accent)"
            >
              Draft a nudge
            </button>
            <button
              type="button"
              onClick={() => dismiss(item.threadId)}
              title="Dismiss"
              aria-label="Dismiss"
              className="shrink-0 rounded-full p-1.5 text-(--ink-soft) transition hover:bg-(--accent)/15 hover:text-(--ink)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
