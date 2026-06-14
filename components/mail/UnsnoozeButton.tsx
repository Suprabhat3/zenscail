"use client";

import { useTransition } from "react";
import { unsnoozeThread } from "@/app/(app)/mail/schedule-actions";
import { useToast } from "@/components/ui/Toast";

export function UnsnoozeButton({ threadId }: { threadId: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await unsnoozeThread(threadId);
            toast("Moved back to inbox");
          } catch {
            toast("Couldn't un-snooze");
          }
        })
      }
      className="rounded-full border border-(--line) px-3 py-1.5 text-xs font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink) disabled:opacity-50"
    >
      {pending ? "Moving…" : "Un-snooze"}
    </button>
  );
}
