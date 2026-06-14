"use client";

import { useEffect } from "react";
import { snoozeThread } from "@/app/(app)/mail/schedule-actions";
import { useToast } from "@/components/ui/Toast";
import { snoozePresets, fmtDateTime } from "@/lib/timePresets";

/**
 * Mounted once in the app shell. Listens for the `zenscail:snooze` event fired
 * by the `h` keyboard shortcut and snoozes the focused thread to a sensible
 * default ("Tomorrow") — the hover snooze menu can't be opened from a hidden
 * row, so the hotkey commits a default and shows an Undo-able toast instead.
 */
export function SnoozeHotkeyBridge() {
  const { toast } = useToast();

  useEffect(() => {
    async function onSnooze(e: Event) {
      const threadId = (e as CustomEvent<{ threadId: string }>).detail?.threadId;
      if (!threadId) return;
      // "Tomorrow" preset (last in the common list); fall back to first.
      const presets = snoozePresets();
      const target = presets.find((p) => p.label === "Tomorrow") ?? presets[0];
      try {
        await snoozeThread(threadId, target.date.toISOString());
        toast(`Snoozed until ${fmtDateTime(target.date)}`);
      } catch {
        toast("Couldn't snooze this thread");
      }
    }
    window.addEventListener("zenscail:snooze", onSnooze);
    return () => window.removeEventListener("zenscail:snooze", onSnooze);
  }, [toast]);

  return null;
}
