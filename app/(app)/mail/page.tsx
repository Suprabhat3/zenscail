import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { searchCachedMessages, refreshMessages } from "@/lib/gmail";
import { refreshInbox, trashMessageAction, archiveMessageAction } from "./actions";

export const metadata = { title: "Mail — ZenScail" };

function formatDate(value: string | number | null | undefined): string {
  if (value == null) return "";
  const n = Number(value);
  const d = new Date(Number.isNaN(n) || n <= 0 ? String(value) : n);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  let messages = await searchCachedMessages(t, { query: q, limit: 50 });

  // Empty cache on first visit: try one refresh; if Gmail isn't connected
  // yet this is where we find out and route to /connect.
  if (messages.length === 0 && !q) {
    const refreshed = await refreshMessages(t);
    if (!refreshed.success) redirect("/connect");
    messages = await searchCachedMessages(t, { limit: 50 });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl">Inbox</h1>
        <div className="flex items-center gap-3">
          <form action="/mail" className="flex">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search mail…"
              className="w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
            />
          </form>
          <form action={refreshInbox}>
            <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
              Refresh
            </button>
          </form>
          <Link
            href="/mail/compose"
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-white"
          >
            Compose
          </Link>
        </div>
      </div>

      {q && (
        <p className="mt-3 text-sm text-neutral-400">
          Results for “{q}” —{" "}
          <Link href="/mail" className="underline hover:text-neutral-200">
            clear
          </Link>
        </p>
      )}

      <ul className="mt-6 divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900">
        {messages.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-neutral-500">
            {q ? "No messages match your search." : "No messages yet. Hit Refresh to sync your inbox."}
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/50">
            <Link
              href={`/mail/thread/${m.threadId}`}
              data-thread-link
              className="min-w-0 flex-1 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-neutral-200">
                  {m.from || "(unknown sender)"}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {formatDate(m.internalDate ?? m.createdAt)}
                </span>
              </div>
              <p className="truncate text-sm text-neutral-300">{m.subject || "(no subject)"}</p>
              <p className="truncate text-xs text-neutral-500">{m.snippet}</p>
            </Link>
            <div className="hidden shrink-0 gap-1 group-hover:flex">
              <form action={archiveMessageAction}>
                <input type="hidden" name="id" value={m.id} />
                <button data-row-action="archive" title="Archive" className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700">
                  Archive
                </button>
              </form>
              <form action={trashMessageAction}>
                <input type="hidden" name="id" value={m.id} />
                <button data-row-action="trash" title="Trash" className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700">
                  Trash
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
