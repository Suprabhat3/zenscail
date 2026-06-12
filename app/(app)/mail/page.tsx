import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { listInboxMessages } from "@/lib/gmail";
import { classifyMessages, getPriorities, type Priority } from "@/lib/ai/classify";
import { PriorityBadge } from "@/components/mail/PriorityBadge";
import { refreshInbox, trashMessageAction, archiveMessageAction } from "./actions";

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, normal: 1, low: 2 };

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
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q, view } = await searchParams;
  const urgentFirst = view === "urgent";
  const session = await requireSession();
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const result = await listInboxMessages(t, { query: q, limit: 25 });
  if (!result.ok) redirect("/connect");
  let messages = result.messages;

  await classifyMessages(userId, messages);
  const priorities = await getPriorities(
    userId,
    messages.map((m) => m.id).filter((id): id is string => Boolean(id)),
  );

  if (urgentFirst) {
    messages = [...messages].sort((a, b) => {
      const pa = PRIORITY_RANK[priorities.get(a.id ?? "")?.priority ?? "normal"];
      const pb = PRIORITY_RANK[priorities.get(b.id ?? "")?.priority ?? "normal"];
      return pa - pb;
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-(--ink)">Inbox</h1>
        <div className="flex items-center gap-2">
          <Link
            href={urgentFirst ? "/mail" : "/mail?view=urgent"}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              urgentFirst
                ? "border-(--accent)/40 bg-(--accent-soft) text-(--accent-deep)"
                : "border-(--line) text-(--ink-soft) hover:border-(--ink) hover:text-(--ink)"
            }`}
          >
            Urgent first
          </Link>
          <form action="/mail" className="flex">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search mail…"
              className="w-56 rounded-full border border-(--line) bg-(--paper) px-4 py-1.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
            />
          </form>
          <form action={refreshInbox}>
            <button className="rounded-full border border-(--line) px-3 py-1.5 text-sm text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)">
              Refresh
            </button>
          </form>
          <Link
            href="/mail/compose"
            className="rounded-full bg-(--ink) px-4 py-1.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
          >
            Compose
          </Link>
        </div>
      </div>

      {q && (
        <p className="mt-3 text-sm text-(--muted)">
          Results for &ldquo;{q}&rdquo; —{" "}
          <Link href="/mail" className="text-(--accent) underline hover:text-(--accent-deep)">
            clear
          </Link>
        </p>
      )}

      {/* Mail list */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
        {messages.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-(--muted)">
            {q ? "No messages match your search." : "No messages yet. Hit Refresh to sync your inbox."}
          </div>
        )}
        <ul className="divide-y divide-(--line-soft)">
          {messages.map((m) => (
            <li key={m.id} className="group relative flex items-center gap-3 px-5 py-3.5 transition hover:bg-(--bg)">
              <Link
                href={`/mail/thread/${m.threadId}`}
                data-thread-link
                className="min-w-0 flex-1 focus:outline-none"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {(() => {
                      const p = m.id ? priorities.get(m.id) : undefined;
                      return p ? <PriorityBadge priority={p.priority} reason={p.reason} /> : null;
                    })()}
                    <span className="truncate text-sm font-semibold text-(--ink)">
                      {m.from || "(unknown sender)"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-(--muted)">
                    {formatDate(m.internalDate)}
                  </span>
                </div>
                <p className="truncate text-sm text-(--ink-soft)">{m.subject || "(no subject)"}</p>
                <p className="truncate text-xs text-(--muted)">{m.snippet}</p>
              </Link>
              <div className="hidden shrink-0 gap-1 group-hover:flex">
                <form action={archiveMessageAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    data-row-action="archive"
                    title="Archive"
                    className="rounded-full border border-(--line) px-2.5 py-1 text-xs text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
                  >
                    Archive
                  </button>
                </form>
                <form action={trashMessageAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    data-row-action="trash"
                    title="Trash"
                    className="rounded-full border border-(--line) px-2.5 py-1 text-xs text-(--accent) transition hover:bg-(--accent-soft)"
                  >
                    Trash
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
