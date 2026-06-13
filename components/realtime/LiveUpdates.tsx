"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type InboxEvent = { plugin: "gmail" | "googlecalendar"; type: string; at: number };

/**
 * Mounted in the (app) shell. Holds one EventSource to /api/stream for the
 * signed-in user and, when a Corsair webhook fires, refreshes the relevant
 * server-rendered feed (and shows a small toast). The browser auto-reconnects
 * the EventSource on drop, so no manual retry loop is needed.
 */
export function LiveUpdates() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [toast, setToast] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.addEventListener("inbox", (e) => {
      let data: InboxEvent;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        return;
      }

      const path = pathnameRef.current;
      const onMail = path.startsWith("/mail");
      const onCalendar = path.startsWith("/calendar");
      const relevant =
        (data.plugin === "gmail" && onMail) ||
        (data.plugin === "googlecalendar" && onCalendar);

      // Debounce: a burst of webhook events triggers a single refresh.
      if (relevant) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 600);
      }

      const label =
        data.plugin === "gmail" ? "New mail activity" : "Calendar updated";
      setToast(relevant ? `${label} — refreshing…` : label);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    });

    return () => {
      source.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [router]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-(--line) bg-(--paper) px-4 py-2 text-sm font-medium text-(--ink) shadow-(--shadow-card)"
    >
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-(--accent) align-middle" />
      {toast}
    </div>
  );
}
