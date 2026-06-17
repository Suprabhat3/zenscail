"use client";

import { useTransition } from "react";
import { cancelScheduledSend } from "@/app/(app)/mail/schedule-actions";
import { useToast } from "@/components/ui/Toast";

export function CancelSendButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { canceled } = await cancelScheduledSend(id).catch(() => ({
            canceled: false,
          }));
          toast(canceled ? "Scheduled send canceled" : "Already sent");
        })
      }
      className="rounded-full border border-(--line) px-3 py-1.5 text-xs font-semibold text-(--accent) transition hover:bg-(--accent-soft) disabled:opacity-50"
    >
      {pending ? "Canceling…" : "Cancel"}
    </button>
  );
}
