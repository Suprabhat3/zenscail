import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { createConnectLink } from "./actions";

export const metadata = { title: "Connect accounts — ZenScail" };

// Probes must be api.* paths: db.* reads hit Corsair's local cache and
// succeed even when the tenant has never connected the plugin.
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
        <h1 className="font-serif text-2xl">Corsair not configured</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Set <code>CORSAIR_DEV_KEY</code> in <code>.env</code>, run{" "}
          <code>pnpm provision:corsair</code>, then set{" "}
          <code>CORSAIR_INSTANCE_ID</code> and restart the dev server.
        </p>
      </div>
    );
  }

  const tenantId = await ensureCorsairTenant(session.user.id);
  const statuses = await getConnectionStatus(tenantId);
  const allConnected = statuses.every((s) => s.connected);

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-serif text-2xl">Connect your Google account</h1>
      <p className="mt-2 text-sm text-neutral-400">
        ZenScail needs access to Gmail and Google Calendar to manage your inbox
        and schedule.
      </p>

      <ul className="mt-8 space-y-3">
        {statuses.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
          >
            <span className="text-sm">{s.label}</span>
            <span
              className={`text-xs ${s.connected ? "text-emerald-400" : "text-neutral-500"}`}
            >
              {s.connected ? "Connected" : "Not connected"}
            </span>
          </li>
        ))}
      </ul>

      <form action={createConnectLink} className="mt-8">
        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
        >
          {allConnected ? "Reconnect accounts" : "Connect with Corsair"}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-neutral-500">
        You&apos;ll be redirected to a secure Corsair page to authorize access.
      </p>
      {allConnected && (
        <p className="mt-6 text-center text-sm">
          <a href="/mail" className="text-amber-400 hover:text-amber-300">
            All set — go to your inbox →
          </a>
        </p>
      )}
    </div>
  );
}
