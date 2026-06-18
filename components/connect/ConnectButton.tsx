"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthorizeUrl } from "@/app/(app)/connect/actions";
import { CONNECT_PLUGINS, type ConnectPlugin } from "@/app/(app)/connect/plugins";

const DONE_MESSAGE = "zenscail:connect-complete";

type Status = { id: string; label: string; connected: boolean };

/** Human label + verb per plugin, for the staged connect prompt. */
const PLUGIN_LABEL: Record<ConnectPlugin, string> = {
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
};

export function ConnectButton({
  statuses,
  allConnected,
}: {
  statuses: Status[];
  allConnected: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  // The next plugin to connect = first one in our order that isn't connected.
  const nextPlugin = CONNECT_PLUGINS.find(
    (id) => !statuses.find((s) => s.id === id)?.connected,
  );
  // Which step are we on? (1-based, for "Step 1 of 2" copy.)
  const stepIndex = nextPlugin ? CONNECT_PLUGINS.indexOf(nextPlugin) + 1 : 0;

  useEffect(() => {
    if (allConnected) setPending(false);
  }, [allConnected]);

  // The popup signals which plugin just connected; re-probe so the UI advances
  // to the next step (or shows all-connected) on its own.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== DONE_MESSAGE) return;
      setPending(false);
      refresh();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refresh]);

  // Safety net while a popup is open (e.g. it was closed before messaging us).
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

  async function handleCheck() {
    setChecking(true);
    refresh();
    setTimeout(() => setChecking(false), 1200);
  }

  async function handleConnect(plugin: ConnectPlugin) {
    setLoading(true);
    setError(null);

    // Open the popup synchronously (inside the click) so it isn't blocked,
    // then point it at this plugin's authorize URL once we have it.
    const popup = window.open(
      "about:blank",
      "zenscail-connect",
      "width=520,height=680,menubar=no,toolbar=no,location=no,status=no",
    );

    if (!popup) {
      setError("Pop-up blocked. Allow pop-ups for this site and try again.");
      setLoading(false);
      return;
    }

    try {
      const { url } = await createAuthorizeUrl(plugin);
      popup.location.href = url;
      setPending(true);
    } catch {
      popup.close();
      setError("Could not start connection. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const connectedCount = statuses.filter((s) => s.connected).length;

  return (
    <div className="mt-8">
      {pending && nextPlugin && (
        <div className="mb-4 rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4">
          <p className="text-sm font-medium text-[#7A5414]">
            Authorize {PLUGIN_LABEL[nextPlugin]} in the pop-up window.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            This page updates automatically once you&apos;re done.
          </p>
        </div>
      )}

      {/* Staged: connect one plugin at a time. After the first connects, the
          status above flips to "Connected" and this advances to the next. */}
      {nextPlugin ? (
        <>
          {connectedCount > 0 && (
            <p className="mb-3 text-center text-sm font-medium text-[#4D5C40]">
              {PLUGIN_LABEL[CONNECT_PLUGINS[stepIndex - 2]]} connected — now
              connect {PLUGIN_LABEL[nextPlugin]}.
            </p>
          )}
          <button
            type="button"
            onClick={() => handleConnect(nextPlugin)}
            disabled={loading}
            className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
          >
            {loading
              ? "Opening…"
              : `Connect ${PLUGIN_LABEL[nextPlugin]} (Step ${stepIndex} of ${CONNECT_PLUGINS.length})`}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => handleConnect(CONNECT_PLUGINS[0])}
          disabled={loading}
          className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
        >
          {loading ? "Opening…" : "Reconnect accounts"}
        </button>
      )}

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
        </div>
      )}

      {error && (
        <p className="mt-3 text-center text-xs text-(--accent-deep)">{error}</p>
      )}

      <p className="mt-3 text-center text-xs text-(--muted)">
        Opens a secure Google sign-in window — you stay right here.
      </p>
    </div>
  );
}
