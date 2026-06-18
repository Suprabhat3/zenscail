"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthorizeUrl } from "@/app/(app)/connect/actions";
import { CONNECT_PLUGINS, type ConnectPlugin } from "@/app/(app)/connect/plugins";

const DONE_MESSAGE = "zenscail:connect-complete";

const PLUGIN_LABEL: Record<ConnectPlugin, string> = {
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
};

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

  // The next plugin to connect = first one in our order that isn't connected.
  const nextPlugin = CONNECT_PLUGINS.find(
    (id) => !statuses.find((s) => s.id === id)?.connected,
  );
  const stepIndex = nextPlugin ? CONNECT_PLUGINS.indexOf(nextPlugin) + 1 : 0;
  const connectedCount = statuses.filter((s) => s.connected).length;

  // The popup signals which plugin just connected; refresh so the UI advances.
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

  // Safety-net poll while the popup is open (e.g. closed early / no message).
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

  async function handleConnect(plugin: ConnectPlugin) {
    setLoading(true);
    setError(null);

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

      {pending && nextPlugin && configured && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4 text-left">
          <p className="text-sm font-medium text-[#7A5414]">
            Authorize {PLUGIN_LABEL[nextPlugin]} in the pop-up window.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            When you&apos;re done, this updates automatically.
          </p>
        </div>
      )}

      {!pending && nextPlugin && configured && connectedCount > 0 && (
        <p className="mx-auto mt-6 max-w-md text-sm font-medium text-[#4D5C40]">
          {PLUGIN_LABEL[CONNECT_PLUGINS[stepIndex - 2]]} connected — now connect{" "}
          {PLUGIN_LABEL[nextPlugin]}.
        </p>
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
        ) : configured && nextPlugin ? (
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
