"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createConnectLink } from "@/app/(app)/connect/actions";

type Status = { id: string; label: string; connected: boolean };

export function ConnectStep({
  statuses,
  allConnected,
  configured,
  connectedEmail,
}: {
  statuses: Status[];
  allConnected: boolean;
  configured: boolean;
  connectedEmail: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  // Poll for completion while the Corsair tab is open.
  useEffect(() => {
    if (!pending || allConnected) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refresh, 4000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [pending, allConnected, refresh]);

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
    <div className="text-center">
      <h1 className="font-serif text-3xl font-normal tracking-tight text-(--ink)">
        Connect your Google account
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-(--ink-soft)">
        ZenScail reads and organizes your Gmail and Google Calendar so it can write
        your daily brief and keep your inbox calm. Nothing is shared.
      </p>

      <ul className="mx-auto mt-8 max-w-md space-y-3 text-left">
        {statuses.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-2xl border border-(--line-soft) bg-(--paper) px-5 py-4 shadow-(--shadow-card)"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-2 w-2 rounded-full ${s.connected ? "bg-(--sage)" : "bg-(--line)"}`}
              />
              <span className="text-sm font-medium text-(--ink)">{s.label}</span>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                s.connected
                  ? "bg-[#EAEFE4] text-[#4D5C40]"
                  : "bg-(--bg-deep) text-(--muted)"
              }`}
            >
              {s.connected ? "Connected" : "Not connected"}
            </span>
          </li>
        ))}
      </ul>

      {connectedEmail && (
        <p className="mx-auto mt-4 max-w-md text-sm text-(--ink-soft)">
          Mailbox:{" "}
          <span className="font-semibold text-(--ink)">{connectedEmail}</span>
        </p>
      )}

      {!configured && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4 text-left">
          <p className="text-sm font-medium text-[#7A5414]">
            Corsair isn&apos;t configured on this server.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            You can continue setup and connect Google later from the Connect page.
          </p>
        </div>
      )}

      {pending && !allConnected && configured && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4 text-left">
          <p className="text-sm font-medium text-[#7A5414]">
            Finish authorizing in the new tab.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            When you&apos;re done, return here — this updates automatically.
          </p>
        </div>
      )}

      <div className="mx-auto mt-8 max-w-md">
        {allConnected ? (
          <button
            type="button"
            onClick={() => router.push("/onboarding?step=ai")}
            className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
          >
            Continue →
          </button>
        ) : configured ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
          >
            {loading ? "Opening…" : "Connect with Google"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/onboarding?step=ai")}
            className="w-full rounded-full border border-(--line) bg-(--paper) px-4 py-3 text-sm font-semibold text-(--ink) transition hover:border-(--ink)"
          >
            Continue without connecting
          </button>
        )}

        {error && (
          <p className="mt-3 text-center text-xs text-(--accent-deep)">{error}</p>
        )}
      </div>
    </div>
  );
}
