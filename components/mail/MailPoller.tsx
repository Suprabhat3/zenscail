"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { pollInbox } from "@/app/(app)/mail/poll-actions";

const INTERVAL_MS = 60_000;

/**
 * Inbox freshness via client polling — the reliable counterpart to the flaky
 * Corsair webhook. Mounted on mail pages; every 60s (only while the tab is
 * visible and we're on a /mail route) it calls the lightweight pollInbox action,
 * which refreshes the local cache and returns a signature. When the signature
 * changes, we router.refresh() to re-render from the now-updated cache. Polling
 * stops entirely when the user leaves /mail or backgrounds the tab, so it never
 * burns API calls in the background.
 */
export function MailPoller() {
  const router = useRouter();
  const pathname = usePathname();
  const onMail = pathname.startsWith("/mail");
  const lastSig = useRef<string | null>(null);

  useEffect(() => {
    if (!onMail) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const { ok, signature } = await pollInbox();
        if (cancelled || !ok) return;
        // Seed on first run so we don't refresh immediately on mount.
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
    // Run once shortly after mount to seed the signature.
    const seed = setTimeout(tick, 1_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(seed);
    };
  }, [onMail, router]);

  return null;
}
