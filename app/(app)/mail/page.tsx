import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { prisma } from "@/lib/prisma";
import { listInboxMessages, getThread, header } from "@/lib/gmail";
import { classifyMessages, getPriorities, type Priority } from "@/lib/ai/classify";
import { PriorityBadge } from "@/components/mail/PriorityBadge";
import { SenderAvatar, parseSender } from "@/components/mail/SenderAvatar";
import { SnoozeMenu } from "@/components/mail/SnoozeMenu";
import { UnsnoozeButton } from "@/components/mail/UnsnoozeButton";
import { CancelSendButton } from "@/components/mail/CancelSendButton";
import { refreshInbox, trashMessageAction, archiveMessageAction } from "./actions";
import { catchUpSchedules } from "./schedule-actions";

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

function formatWhen(d: Date): string {
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const UNREAD_QUERY = "is:unread";

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q, view } = await searchParams;
  const urgentFirst = view === "urgent";
  const unreadView = q === UNREAD_QUERY;
  const snoozedView = view === "snoozed";
  const scheduledView = view === "scheduled";
  const session = await requireSession();
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  // Opportunistic catch-up: wake due snoozes + flush overdue sends when the
  // inbox opens, so the app works even where cron cadence is coarse.
  await catchUpSchedules().catch(() => {});

  const tabs = [
    { href: "/mail", label: "All", active: !urgentFirst && !unreadView && !snoozedView && !scheduledView },
    { href: "/mail?view=urgent", label: "Urgent first", active: urgentFirst },
    { href: `/mail?q=${UNREAD_QUERY}`, label: "Unread", active: unreadView },
    { href: "/mail?view=snoozed", label: "Snoozed", active: snoozedView },
    { href: "/mail?view=scheduled", label: "Scheduled", active: scheduledView },
  ];

  // --- Snoozed view ---
  let snoozed: { threadId: string; subject: string; snippet: string; until: Date }[] = [];
  if (snoozedView) {
    const rows = await prisma.snoozedThread.findMany({
      where: { userId },
      orderBy: { snoozeUntil: "asc" },
      take: 50,
    });
    snoozed = await Promise.all(
      rows.map(async (r) => {
        const res = await getThread(t, r.threadId).catch(() => null);
        const first = res?.success ? res.data.messages?.[0] : undefined;
        return {
          threadId: r.threadId,
          subject: header(first?.payload, "Subject") || "(no subject)",
          snippet: res?.success ? res.data.snippet ?? "" : "",
          until: r.snoozeUntil,
        };
      }),
    );
  }

  // --- Scheduled (outbox) view ---
  let scheduled: {
    id: number;
    to: string;
    subject: string;
    sendAt: Date;
    status: string;
    isUndo: boolean;
    error: string | null;
  }[] = [];
  if (scheduledView) {
    scheduled = await prisma.scheduledSend.findMany({
      where: { userId, status: { in: ["pending", "sending", "failed"] } },
      orderBy: { sendAt: "asc" },
      take: 50,
      select: { id: true, to: true, subject: true, sendAt: true, status: true, isUndo: true, error: true },
    });
  }

  // --- Inbox / search view ---
  let messages: Awaited<ReturnType<typeof listInboxMessages>>["messages"] = [];
  let priorities = new Map<string, { priority: Priority; reason?: string | null }>();
  if (!snoozedView && !scheduledView) {
    const result = await listInboxMessages(t, { query: q, limit: 25 });
    if (!result.ok) redirect("/connect");
    messages = result.messages;

    await classifyMessages(userId, messages);
    priorities = await getPriorities(
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
  }

  const unreadCount = messages.filter((m) => m.unread).length;

  const subtitle = snoozedView
    ? `${snoozed.length} snoozed thread${snoozed.length === 1 ? "" : "s"}`
    : scheduledView
      ? `${scheduled.length} queued send${scheduled.length === 1 ? "" : "s"}`
      : `${messages.length} message${messages.length === 1 ? "" : "s"}${
          unreadCount > 0 && !unreadView ? ` · ${unreadCount} unread` : ""
        }`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-(--ink)">Inbox</h1>
          <p className="mt-0.5 text-sm text-(--muted)">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/mail" className="relative">
            <svg
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-(--muted)"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={unreadView ? "" : q}
              placeholder="Search mail…"
              className="w-56 rounded-full border border-(--line) bg-(--paper) py-2 pr-4 pl-9 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
            />
          </form>
          <form action={refreshInbox}>
            <button
              title="Sync with Gmail"
              className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </form>
          <Link
            href="/mail/compose"
            className="flex items-center gap-1.5 rounded-full bg-(--ink) px-4 py-2 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Compose
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-5 flex items-center gap-1 border-b border-(--line-soft)">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`relative px-3.5 pb-2.5 text-sm font-semibold transition ${
              tab.active ? "text-(--ink)" : "text-(--muted) hover:text-(--ink-soft)"
            }`}
          >
            {tab.label}
            {tab.active && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-(--accent)" />
            )}
          </Link>
        ))}
        {q && !unreadView && (
          <span className="ml-auto pb-2.5 text-sm text-(--muted)">
            Results for &ldquo;{q}&rdquo; —{" "}
            <Link href="/mail" className="text-(--accent) underline hover:text-(--accent-deep)">
              clear
            </Link>
          </span>
        )}
      </div>

      {/* Body */}
      {snoozedView ? (
        <SnoozedList snoozed={snoozed} formatWhen={formatWhen} />
      ) : scheduledView ? (
        <ScheduledList scheduled={scheduled} formatWhen={formatWhen} />
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
            {messages.length === 0 && (
              <div className="px-4 py-20 text-center">
                <svg className="mx-auto text-(--line)" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <p className="mt-3 font-serif text-lg text-(--ink)">
                  {q && !unreadView
                    ? "No messages match your search"
                    : unreadView
                      ? "You're all caught up"
                      : "Nothing here yet"}
                </p>
                <p className="mt-1 text-sm text-(--muted)">
                  {q ? "Try a different search." : "Hit Refresh to sync your inbox."}
                </p>
              </div>
            )}
            <ul className="divide-y divide-(--line-soft)">
              {messages.map((m) => {
                const p = m.id ? priorities.get(m.id) : undefined;
                const sender = parseSender(m.from || "");
                return (
                  <li
                    key={m.id}
                    className={`group relative flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-(--bg) sm:px-5 ${
                      m.unread ? "bg-(--paper)" : "bg-(--bg)/40"
                    }`}
                  >
                    <SenderAvatar from={m.from || "?"} />
                    <Link
                      href={`/mail/thread/${m.threadId}`}
                      data-thread-link
                      data-thread-id={m.threadId}
                      className="min-w-0 flex-1 focus:outline-none"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          {m.unread && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-(--accent)"
                              title="Unread"
                            />
                          )}
                          <span
                            className={`truncate text-sm ${
                              m.unread ? "font-bold text-(--ink)" : "font-medium text-(--ink-soft)"
                            }`}
                          >
                            {sender.name || "(unknown sender)"}
                          </span>
                          {p && p.priority !== "normal" && (
                            <PriorityBadge priority={p.priority} reason={p.reason} />
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-(--muted)">
                          {formatDate(m.internalDate)}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-sm ${
                          m.unread ? "font-semibold text-(--ink)" : "text-(--ink-soft)"
                        }`}
                      >
                        {m.subject || "(no subject)"}
                      </p>
                      <p className="truncate text-xs text-(--muted)">{m.snippet}</p>
                    </Link>

                    {/* Hover actions */}
                    <div className="absolute top-1/2 right-4 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-(--line-soft) bg-(--paper) p-1 shadow-(--shadow-card) group-hover:flex">
                      <SnoozeMenu threadId={m.threadId} variant="icon" />
                      <form action={archiveMessageAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          data-row-action="archive"
                          title="Archive"
                          aria-label="Archive"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink)"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="2" y="3" width="20" height="5" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
                          </svg>
                        </button>
                      </form>
                      <form action={trashMessageAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          data-row-action="trash"
                          title="Trash"
                          aria-label="Trash"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-(--accent) transition hover:bg-(--accent-soft)"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-3 text-center text-xs text-(--muted)">
            Tip: press <kbd className="rounded border border-(--line) bg-(--paper) px-1">j</kbd>/
            <kbd className="rounded border border-(--line) bg-(--paper) px-1">k</kbd> to move,{" "}
            <kbd className="rounded border border-(--line) bg-(--paper) px-1">h</kbd> to snooze,{" "}
            <kbd className="rounded border border-(--line) bg-(--paper) px-1">c</kbd> to compose
          </p>
        </>
      )}
    </div>
  );
}

function SnoozedList({
  snoozed,
  formatWhen,
}: {
  snoozed: { threadId: string; subject: string; snippet: string; until: Date }[];
  formatWhen: (d: Date) => string;
}) {
  if (snoozed.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-20 text-center shadow-(--shadow-card)">
        <p className="font-serif text-lg text-(--ink)">Nothing snoozed</p>
        <p className="mt-1 text-sm text-(--muted)">
          Snooze a thread with the clock icon or the <kbd className="rounded border border-(--line) bg-(--bg) px-1">h</kbd> key — it&rsquo;ll come back here.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-(--line-soft) overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      {snoozed.map((s) => (
        <li key={s.threadId} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-(--bg)">
          <Link href={`/mail/thread/${s.threadId}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-(--ink)">{s.subject}</p>
            <p className="truncate text-xs text-(--muted)">{s.snippet}</p>
          </Link>
          <span className="shrink-0 text-xs font-medium text-(--gold)">
            Returns {formatWhen(s.until)}
          </span>
          <UnsnoozeButton threadId={s.threadId} />
        </li>
      ))}
    </ul>
  );
}

function ScheduledList({
  scheduled,
  formatWhen,
}: {
  scheduled: {
    id: number;
    to: string;
    subject: string;
    sendAt: Date;
    status: string;
    isUndo: boolean;
    error: string | null;
  }[];
  formatWhen: (d: Date) => string;
}) {
  if (scheduled.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-20 text-center shadow-(--shadow-card)">
        <p className="font-serif text-lg text-(--ink)">No scheduled sends</p>
        <p className="mt-1 text-sm text-(--muted)">
          Use the caret next to Send in the composer to schedule mail for later.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-(--line-soft) overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      {scheduled.map((s) => (
        <li key={s.id} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-(--bg)">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-(--ink)">
              {s.subject || "(no subject)"}
            </p>
            <p className="truncate text-xs text-(--muted)">To {s.to}</p>
            {s.status === "failed" && s.error && (
              <p className="truncate text-xs text-(--accent)">Failed: {s.error}</p>
            )}
          </div>
          <span className="shrink-0 text-right text-xs">
            <span className={`font-medium ${s.status === "failed" ? "text-(--accent)" : "text-(--gold)"}`}>
              {s.status === "failed" ? "Failed" : `Sends ${formatWhen(s.sendAt)}`}
            </span>
          </span>
          {(s.status === "pending" || s.status === "sending") && <CancelSendButton id={s.id} />}
        </li>
      ))}
    </ul>
  );
}
