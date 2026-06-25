import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { InboxMessage } from "@/lib/gmail";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { prisma } from "@/lib/prisma";
import { listInboxMessages, getThread, header, getLabelData } from "@/lib/gmail";
import { MailSidebar, MailFolderChips } from "@/components/mail/MailSidebar";
import { MailNavProvider, MailBody } from "@/components/mail/MailNav";
import {
  classifyMessages,
  getPriorities,
  displayCategory,
  type Priority,
  type Category,
} from "@/lib/ai/classify";
import { PriorityBadge } from "@/components/mail/PriorityBadge";
import { HoverSummary } from "@/components/mail/HoverSummary";
import { SenderAvatar, parseSender } from "@/components/mail/SenderAvatar";
import { SnoozeMenu } from "@/components/mail/SnoozeMenu";
import { UnsnoozeButton } from "@/components/mail/UnsnoozeButton";
import { CancelSendButton } from "@/components/mail/CancelSendButton";
import { BundleSection } from "@/components/mail/BundleSection";
import { LayoutToggle } from "@/components/mail/LayoutToggle";
import { FollowUpBanner } from "@/components/mail/FollowUpBanner";
import { LocalDraftsList, type LocalDraft } from "@/components/mail/LocalDraftsList";
import { refreshInbox, trashMessageAction, archiveMessageAction } from "./actions";
import { catchUpSchedules } from "./schedule-actions";
import { processDueFollowUps, listSurfacedFollowUps } from "@/lib/followUp";
import { getUserTimeZone, formatInTZ, ymdInTZ } from "@/lib/timezone";

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, normal: 1, low: 2 };

type RowMeta = { priority: Priority; reason?: string | null; category?: string | null };

const BUNDLE_ORDER: Category[] = ["important", "newsletter", "social", "notification", "other"];
const BUNDLE_META: Record<Category, { emoji: string; title: string }> = {
  important: { emoji: "📌", title: "Important" },
  newsletter: { emoji: "📰", title: "Newsletters" },
  social: { emoji: "👥", title: "Social" },
  notification: { emoji: "🔔", title: "Notifications" },
  other: { emoji: "📥", title: "Everything else" },
};

export const metadata = { title: "Mail — ZenScail" };

function formatDate(value: string | number | null | undefined, tz: string): string {
  if (value == null) return "";
  const n = Number(value);
  const d = new Date(Number.isNaN(n) || n <= 0 ? String(value) : n);
  if (Number.isNaN(d.getTime())) return "";
  return ymdInTZ(d.getTime(), tz) === ymdInTZ(Date.now(), tz)
    ? formatInTZ(d, tz, { hour: "2-digit", minute: "2-digit" })
    : formatInTZ(d, tz, { month: "short", day: "numeric" });
}

function formatWhen(d: Date, tz: string): string {
  return formatInTZ(d, tz, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const UNREAD_QUERY = "is:unread";

// Gmail folders (label-backed views) selectable from the sidebar.
type FolderConfig = {
  title: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
};
const FOLDERS: Record<string, FolderConfig> = {
  inbox: { title: "Inbox", labelIds: ["INBOX"] },
  starred: { title: "Starred", labelIds: ["STARRED"] },
  important: { title: "Important", labelIds: ["IMPORTANT"] },
  sent: { title: "Sent", labelIds: ["SENT"] },
  drafts: { title: "Drafts", labelIds: ["DRAFT"] },
  spam: { title: "Spam", labelIds: ["SPAM"], includeSpamTrash: true },
  trash: { title: "Trash", labelIds: ["TRASH"], includeSpamTrash: true },
  all: { title: "All Mail", labelIds: [] }, // empty = no label filter = all mail
};

// How many message refs to fetch per page. Gmail caps the per-message hydration
// cost, so this is both the page size and the warm-cache batch size.
const PAGE_SIZE = 25;

// Cursor pagination state lives in the `pg` query param: a base64url-encoded JSON
// array of the Gmail pageTokens traversed to reach the current page. Page 1 has
// an empty stack. Gmail exposes only opaque forward cursors, so keeping the trail
// in the URL is what makes a "Newer" (previous) button possible.
function decodeTokenStack(pg: string | undefined): string[] {
  if (!pg) return [];
  try {
    const arr: unknown = JSON.parse(Buffer.from(pg, "base64url").toString("utf8"));
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
function encodeTokenStack(stack: string[]): string {
  return Buffer.from(JSON.stringify(stack), "utf8").toString("base64url");
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    view?: string;
    folder?: string;
    label?: string;
    pg?: string;
  }>;
}) {
  const { q, view, folder: folderParam, label: labelId, pg } = await searchParams;
  const tokenStack = decodeTokenStack(pg);
  const pageToken = tokenStack.length > 0 ? tokenStack[tokenStack.length - 1] : undefined;
  const pageNumber = tokenStack.length + 1;
  const firstPage = tokenStack.length === 0;
  const urgentFirst = view === "urgent";
  const unreadView = q === UNREAD_QUERY;
  const snoozedView = view === "snoozed";
  const scheduledView = view === "scheduled";
  // Which Gmail folder is selected (defaults to inbox unless searching).
  const folderKey = folderParam && FOLDERS[folderParam] ? folderParam : "inbox";
  const folder = FOLDERS[folderKey];
  const isInbox = folderKey === "inbox" && !labelId && !q;
  const session = await requireSession();
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const showFollowUps = !snoozedView && !scheduledView;

  // Opportunistic catch-up (first page only): wake due snoozes, flush overdue
  // sends, and resolve due follow-ups when the inbox opens, so the app works even
  // where cron cadence is coarse. Runs before the inbox list so woken snoozes
  // show up in it. Skipped while paging deeper to keep Newer/Older snappy.
  if (firstPage) {
    await Promise.all([
      catchUpSchedules().catch(() => {}),
      showFollowUps ? processDueFollowUps({ userId }).catch(() => {}) : Promise.resolve(),
    ]);
  }

  // Sidebar labels, layout cookie, timezone, and the follow-up banner list are
  // independent — fetch them concurrently instead of one await at a time.
  const [labelData, layoutCookie, tz, surfacedFollowUps] = await Promise.all([
    getLabelData(t).catch(() => ({ custom: [], unread: {} })),
    cookies(),
    getUserTimeZone(),
    showFollowUps ? listSurfacedFollowUps(userId).catch(() => []) : Promise.resolve([]),
  ]);
  const activeLabel = labelId
    ? labelData.custom.find((l) => l.id === labelId)
    : undefined;
  // Bundled vs flat layout preference (cookie, toggled client-side).
  const layout: "bundled" | "flat" =
    layoutCookie.get("mail_layout")?.value === "flat" ? "flat" : "bundled";
  // Bundling only applies to the default inbox view; folders/tabs stay flat.
  const isDefaultView =
    isInbox && !urgentFirst && !unreadView && !snoozedView && !scheduledView;
  const bundled = isDefaultView && layout === "bundled";

  // "Inbox context" = the default inbox and its sub-views (Urgent/Unread).
  // Folders, labels, snoozed and scheduled each get their own flat list.
  const inboxContext = !folderParam && !labelId && !snoozedView && !scheduledView;
  const tabs = [
    { href: "/mail", label: "All", active: !urgentFirst && !unreadView },
    { href: "/mail?view=urgent", label: "Urgent first", active: urgentFirst },
    { href: `/mail?q=${UNREAD_QUERY}`, label: "Unread", active: unreadView },
  ];

  const pageTitle = snoozedView
    ? "Snoozed"
    : scheduledView
      ? "Scheduled"
      : activeLabel
        ? activeLabel.name
        : unreadView
          ? "Inbox"
          : q
            ? "Search"
            : folder.title;

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

  // --- Local (DB-backed) drafts, shown atop the Drafts folder ---
  let localDrafts: LocalDraft[] = [];
  if (folderKey === "drafts" && !q) {
    const rows = await prisma.draft.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    localDrafts = rows.map((d) => {
      const text = d.isHtml
        ? d.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : d.body;
      return {
        id: d.id,
        to: d.to,
        subject: d.subject,
        preview: text.slice(0, 120),
        isHtml: d.isHtml,
        updatedAt: formatWhen(d.updatedAt, tz),
      };
    });
  }

  // --- Inbox / search view ---
  let messages: Awaited<ReturnType<typeof listInboxMessages>>["messages"] = [];
  let priorities = new Map<string, RowMeta>();
  let nextPageToken: string | undefined;
  if (!snoozedView && !scheduledView) {
    const listOpts = q
      ? { query: q, limit: PAGE_SIZE, userId, pageToken }
      : labelId
        ? { labelIds: [labelId], limit: PAGE_SIZE, userId, pageToken }
        : { labelIds: folder.labelIds, includeSpamTrash: folder.includeSpamTrash, limit: PAGE_SIZE, userId, pageToken };
    const result = await listInboxMessages(t, listOpts);
    if (!result.ok) redirect("/connect");
    messages = result.messages;
    nextPageToken = result.nextPageToken;

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

  // Group messages into bundles by category (stored, else heuristic).
  type Bundle = { category: Category; messages: InboxMessage[] };
  let bundles: Bundle[] = [];
  if (bundled) {
    const byCat = new Map<Category, InboxMessage[]>();
    for (const m of messages) {
      const cat = displayCategory(m, priorities.get(m.id ?? "")?.category);
      const list = byCat.get(cat) ?? [];
      list.push(m);
      byCat.set(cat, list);
    }
    // Within a bundle, surface urgent → unread → recency.
    for (const list of byCat.values()) {
      list.sort((a, b) => {
        const pa = PRIORITY_RANK[priorities.get(a.id ?? "")?.priority ?? "normal"];
        const pb = PRIORITY_RANK[priorities.get(b.id ?? "")?.priority ?? "normal"];
        if (pa !== pb) return pa - pb;
        if (a.unread !== b.unread) return a.unread ? -1 : 1;
        return b.internalDate - a.internalDate;
      });
    }
    bundles = BUNDLE_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      messages: byCat.get(c)!,
    }));
  }

  const subtitle = snoozedView
    ? `${snoozed.length} snoozed thread${snoozed.length === 1 ? "" : "s"}`
    : scheduledView
      ? `${scheduled.length} queued send${scheduled.length === 1 ? "" : "s"}`
      : `${messages.length} message${messages.length === 1 ? "" : "s"}${
          pageNumber > 1 ? ` · page ${pageNumber}` : ""
        }${unreadCount > 0 && !unreadView ? ` · ${unreadCount} unread` : ""}`;

  // Cursor pagination links (Gmail-backed lists only). "Newer" pops the token
  // stack, "Older" pushes the next cursor; both preserve the active view/query.
  const pageParams = new URLSearchParams();
  if (q) pageParams.set("q", q);
  if (view) pageParams.set("view", view);
  if (folderParam) pageParams.set("folder", folderParam);
  if (labelId) pageParams.set("label", labelId);
  const mkPageHref = (stack: string[]): string => {
    const p = new URLSearchParams(pageParams);
    if (stack.length > 0) p.set("pg", encodeTokenStack(stack));
    const qs = p.toString();
    return qs ? `/mail?${qs}` : "/mail";
  };
  const prevHref = !snoozedView && !scheduledView && pageNumber > 1 ? mkPageHref(tokenStack.slice(0, -1)) : null;
  const nextHref = !snoozedView && !scheduledView && nextPageToken ? mkPageHref([...tokenStack, nextPageToken]) : null;

  return (
    <MailNavProvider>
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <MailSidebar custom={labelData.custom} unread={labelData.unread} />
      <div className="min-w-0 flex-1">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-serif text-2xl text-(--ink) sm:text-3xl">{pageTitle}</h1>
          <p className="mt-0.5 text-sm text-(--muted)">{subtitle}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <form action="/mail" className="relative min-w-0 flex-1 sm:flex-none">
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
              className="w-full rounded-full border border-(--line) bg-(--paper) py-2 pr-4 pl-9 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft) sm:w-56"
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

      {/* Folder switcher (mobile only — replaces the hidden sidebar) */}
      <MailFolderChips custom={labelData.custom} unread={labelData.unread} />

      {/* Filter tabs */}
      <div className="no-scrollbar mt-5 flex items-center gap-1 overflow-x-auto border-b border-(--line-soft)">
        {inboxContext &&
          tabs.map((tab) => (
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
        {isDefaultView && (
          <div className="ml-auto pb-2">
            <LayoutToggle layout={layout} />
          </div>
        )}
      </div>

      {/* Threads waiting on a reply */}
      {showFollowUps && surfacedFollowUps.length > 0 && (
        <FollowUpBanner
          items={surfacedFollowUps.map((f) => ({
            threadId: f.threadId,
            subject: f.subject,
            contact: f.contact,
          }))}
        />
      )}

      {/* Local drafts saved on ZenScail (Drafts folder only) */}
      {folderKey === "drafts" && <LocalDraftsList drafts={localDrafts} />}

      {/* Body */}
      <MailBody>
      {snoozedView ? (
        <SnoozedList snoozed={snoozed} formatWhen={(d) => formatWhen(d, tz)} />
      ) : scheduledView ? (
        <ScheduledList scheduled={scheduled} formatWhen={(d) => formatWhen(d, tz)} />
      ) : messages.length === 0 ? (
        folderKey === "drafts" && localDrafts.length > 0 ? null : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-20 text-center shadow-(--shadow-card)">
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
        )
      ) : bundled ? (
        <>
          <div className="mt-4 space-y-3">
            {bundles.map((b) => {
              const meta = BUNDLE_META[b.category];
              return (
                <BundleSection
                  key={b.category}
                  category={b.category}
                  emoji={meta.emoji}
                  title={meta.title}
                  ids={b.messages.map((m) => m.id).filter((id): id is string => Boolean(id))}
                  unread={b.messages.filter((m) => m.unread).length}
                  defaultOpen={b.category === "important" || b.category === "other"}
                >
                  {b.messages.map((m) => (
                    <MessageRow key={m.id} m={m} p={priorities.get(m.id ?? "")} tz={tz} />
                  ))}
                </BundleSection>
              );
            })}
          </div>
          <InboxTip />
        </>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
            <ul className="divide-y divide-(--line-soft)">
              {messages.map((m) => (
                <MessageRow key={m.id} m={m} p={priorities.get(m.id ?? "")} tz={tz} />
              ))}
            </ul>
          </div>
          <InboxTip />
        </>
      )}
      {(prevHref || nextHref) && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
          {prevHref ? (
            <Link
              href={prevHref}
              className="flex items-center gap-1.5 rounded-full border border-(--line) px-4 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-(--muted)">Page {pageNumber}</span>
          {nextHref ? (
            <Link
              href={nextHref}
              className="flex items-center gap-1.5 rounded-full border border-(--line) px-4 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
            >
              Older
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      </MailBody>
      </div>
    </div>
    </MailNavProvider>
  );
}

function InboxTip() {
  return (
    <p className="mt-3 text-center text-xs text-(--muted)">
      Tip: press <kbd className="rounded border border-(--line) bg-(--paper) px-1">j</kbd>/
      <kbd className="rounded border border-(--line) bg-(--paper) px-1">k</kbd> to move,{" "}
      <kbd className="rounded border border-(--line) bg-(--paper) px-1">h</kbd> to snooze,{" "}
      <kbd className="rounded border border-(--line) bg-(--paper) px-1">c</kbd> to compose
    </p>
  );
}

function MessageRow({ m, p, tz }: { m: InboxMessage; p?: RowMeta; tz: string }) {
  const sender = parseSender(m.from || "");
  return (
    <li
      className={`group relative flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-(--bg) sm:px-5 ${
        m.unread ? "bg-(--paper)" : "bg-(--bg)/40"
      }`}
    >
      <HoverSummary messageId={m.id} />
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
              <span className="h-2 w-2 shrink-0 rounded-full bg-(--accent)" title="Unread" />
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
          <span className="shrink-0 text-xs text-(--muted)">{formatDate(m.internalDate, tz)}</span>
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
