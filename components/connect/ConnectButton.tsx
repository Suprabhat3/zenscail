"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConnectLink } from "@/app/(app)/connect/actions";

export function ConnectButton({ allConnected }: { allConnected: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    if (allConnected) setPending(false);
  }, [allConnected]);

  // The connection happens in the Corsair tab, so this page can't know it
  // succeeded until it re-probes. Auto-polling only runs while `pending`; this
  // gives the user an explicit, always-available way to re-check after they
  // return — with a brief spinner so the action feels acknowledged.
  async function handleCheck() {
    setChecking(true);
    refresh();
    // router.refresh() resolves before the server component re-renders, so hold
    // the spinner briefly for feedback; the new status arrives via props.
    setTimeout(() => setChecking(false), 1200);
  }

  useEffect(() => {
    if (!pending) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refresh, 4000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [pending, refresh]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await createConnectLink();
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        setError("Pop-up blocked. Allow pop-ups for this site and try again.");
        return;
      }
      setPending(true);
    } catch {
      setError("Could not start connection. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {pending && !allConnected && (
        <div className="mb-4 rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4">
          <p className="text-sm font-medium text-[#7A5414]">
            Finish connecting in the new tab — authorize Gmail and Calendar there.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            When you&apos;re done, close that tab and return here. This page updates
            automatically.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
      >
        {loading
          ? "Opening…"
          : allConnected
            ? "Reconnect accounts"
            : "Connect with Corsair"}
      </button>

      {!allConnected && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-(--line) bg-(--paper) px-4 py-3 text-sm font-semibold text-(--ink) transition hover:border-(--accent) hover:text-(--accent-deep) disabled:opacity-60"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={checking ? "animate-spin" : undefined}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {checking ? "Checking…" : "Already connected? Refresh status"}
          </button>
          <p className="mt-2 text-center text-xs text-(--muted)">
            Authorized Gmail &amp; Calendar in the other tab? Come back and tap
            refresh — your status updates here.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-center text-xs text-(--accent-deep)">{error}</p>
      )}

      <p className="mt-3 text-center text-xs text-(--muted)">
        Opens a secure Corsair page in a new tab to authorize access.
      </p>
    </div>
  );
}
