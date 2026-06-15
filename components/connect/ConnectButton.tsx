"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConnectLink } from "@/app/(app)/connect/actions";

export function ConnectButton({ allConnected }: { allConnected: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    if (allConnected) setPending(false);
  }, [allConnected]);

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

      {error && (
        <p className="mt-3 text-center text-xs text-(--accent-deep)">{error}</p>
      )}

      <p className="mt-3 text-center text-xs text-(--muted)">
        Opens a secure Corsair page in a new tab to authorize access.
      </p>
    </div>
  );
}
