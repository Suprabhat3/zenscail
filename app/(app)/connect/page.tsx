import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { syncConnectedEmail } from "@/lib/identity";
import { createConnectLink } from "./actions";

export const metadata = { title: "Connect accounts — ZenScail" };

const PLUGINS = [
  { id: "gmail", label: "Gmail", probe: "gmail.api.labels.list" },
  { id: "googlecalendar", label: "Google Calendar", probe: "googlecalendar.api.events.getMany" },
] as const;

async function getConnectionStatus(tenantId: string) {
  const t = corsairTenant(tenantId);
  return Promise.all(
    PLUGINS.map(async (plugin) => {
      const result = await t.run(plugin.probe);
      return { ...plugin, connected: result.success };
    }),
  );
}

export default async function ConnectPage() {
  const session = await requireSession();

  if (!process.env.CORSAIR_DEV_KEY || !process.env.CORSAIR_INSTANCE_ID) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-2xl font-normal text-(--ink)">Corsair not configured</h1>
        <p className="mt-3 text-sm text-(--muted)">
          Set <code className="rounded bg-(--bg-deep) px-1 py-0.5 text-xs">CORSAIR_DEV_KEY</code> in{" "}
          <code className="rounded bg-(--bg-deep) px-1 py-0.5 text-xs">.env</code>, run{" "}
          <code className="rounded bg-(--bg-deep) px-1 py-0.5 text-xs">pnpm provision:corsair</code>, then set{" "}
          <code className="rounded bg-(--bg-deep) px-1 py-0.5 text-xs">CORSAIR_INSTANCE_ID</code> and restart the dev server.
        </p>
      </div>
    );
  }

  const tenantId = await ensureCorsairTenant(session.user.id);
  const statuses = await getConnectionStatus(tenantId);
  const allConnected = statuses.every((s) => s.connected);
  const gmailConnected = statuses.find((s) => s.id === "gmail")?.connected;

  // Once Gmail is connected, record the real mailbox address so the rest of the
  // app can present it as the user's identity (it may differ from their login).
  const connectedEmail = gmailConnected
    ? await syncConnectedEmail(session.user.id, tenantId)
    : null;
  const mismatch = Boolean(
    connectedEmail &&
      connectedEmail.toLowerCase() !== session.user.email.toLowerCase(),
  );

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      {/* Header */}
      <div className="mb-1 text-sm font-semibold uppercase tracking-widest text-(--accent)">
        <span className="mr-2 inline-block h-px w-5 align-middle bg-(--accent)" />
        Accounts
      </div>
      <h1 className="font-serif text-3xl font-normal tracking-tight text-(--ink)">
        Connect your Google account
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-(--ink-soft)">
        ZenScail needs access to Gmail and Google Calendar to manage your inbox and schedule.
      </p>

      {/* Connection status */}
      <ul className="mt-8 space-y-3">
        {statuses.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-2xl border border-(--line-soft) bg-(--paper) px-5 py-4 shadow-(--shadow-card)"
          >
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${s.connected ? "bg-(--sage)" : "bg-(--line)"}`} />
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
        <div className="mt-6 rounded-2xl border border-(--line-soft) bg-(--paper) px-5 py-4">
          <p className="text-sm text-(--ink-soft)">
            Connected mailbox:{" "}
            <span className="font-semibold text-(--ink)">{connectedEmail}</span>
          </p>
        </div>
      )}

      {mismatch && (
        <div className="mt-4 rounded-2xl border border-(--gold)/40 bg-[#FBF3E3] px-5 py-4">
          <p className="text-sm font-medium text-[#7A5414]">
            Heads up — you signed in as{" "}
            <span className="font-semibold">{session.user.email}</span> but
            connected the{" "}
            <span className="font-semibold">{connectedEmail}</span> mailbox.
          </p>
          <p className="mt-1 text-xs text-[#8A6320]">
            That&apos;s fine if it&apos;s intentional — ZenScail will manage the{" "}
            {connectedEmail} inbox. To use a different account, reconnect below.
          </p>
        </div>
      )}

      {/* CTA */}
      <form action={createConnectLink} className="mt-8">
        <button
          type="submit"
          className="w-full rounded-full bg-(--ink) px-4 py-3 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
        >
          {allConnected ? "Reconnect accounts" : "Connect with Corsair"}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-(--muted)">
        You&apos;ll be redirected to a secure Corsair page to authorize access.
      </p>

      {allConnected && (
        <div className="mt-8 rounded-2xl border border-[#CBD8BC] bg-[#EFF4E8] px-5 py-4">
          <p className="text-sm font-medium text-[#44532F]">
            All accounts connected —{" "}
            <Link href="/mail" className="underline hover:text-[#36421F]">
              go to your inbox →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
