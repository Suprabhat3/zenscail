"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { pollCalendar } from "@/app/(app)/calendar/poll-actions";

const INTERVAL_MS = 60_000;

/**
 * Calendar freshness via client polling — the counterpart to MailPoller.
 * Mounted on calendar pages; every 60s (only while the tab is visible and
 * we're on a /calendar route) it calls pollCalendar, which re-syncs the cached
 * window and returns a signature. When the signature changes, we
 * router.refresh() to re-render from the now-updated cache.
 */
export function CalendarPoller() {
  const router = useRouter();
  const pathname = usePathname();
  const onCalendar = pathname.startsWith("/calendar");
  const lastSig = useRef<string | null>(null);

  useEffect(() => {
    if (!onCalendar) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const { ok, signature } = await pollCalendar();
        if (cancelled || !ok) return;
        if (lastSig.current === null) {
          lastSig.current = signature;
          return;
        }
        if (signature !== lastSig.current) {
          lastSig.current = signature;
          router.refresh();
        }
      } catch {
        // Network/auth hiccup — try again next interval.
      }
    }

    const id = setInterval(tick, INTERVAL_MS);
    const seed = setTimeout(tick, 1_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(seed);
    };
  }, [onCalendar, router]);

  return null;
}
