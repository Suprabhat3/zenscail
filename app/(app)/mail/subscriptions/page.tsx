import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { prisma } from "@/lib/prisma";
import { listInboxMessages, getLabelData, type InboxMessage } from "@/lib/gmail";
import { MailSidebar, MailFolderChips } from "@/components/mail/MailSidebar";
import { MailNavProvider } from "@/components/mail/MailNav";
import { parseSender } from "@/components/mail/SenderAvatar";
import {
  SubscriptionsList,
  type SubscriptionSender,
} from "@/components/mail/SubscriptionsList";
import { getUserTimeZone, formatInTZ } from "@/lib/timezone";
import { isDemoMode, getDemoMessages, DEMO_USER } from "@/lib/demo";

export const metadata = { title: "Subscriptions — ZenScail" };

/**
 * The Subscriptions manager: every newsletter/marketing sender detected via
 * the List-Unsubscribe header (already flagged on each cached inbox row),
 * grouped by sender, with one-click bulk unsubscribe. Senders the user has
 * already freed themselves from are shown in a quiet "done" section below.
 */
export default async function SubscriptionsPage() {
  const demo = await isDemoMode();
  const session = demo ? null : await requireSession();
  const userId = session?.user.id ?? DEMO_USER.id;

  let labelData: Awaited<ReturnType<typeof getLabelData>> = { custom: [], unread: {} };
  let candidates: InboxMessage[] = [];
  let unsubscribed: {
    addr: string;
    name: string;
    method: string;
    link: string | null;
    when: string;
  }[] = [];
  const tz = await getUserTimeZone();

  if (demo) {
    candidates = getDemoMessages().filter((m) => m.hasListUnsubscribe);
  } else {
    const t = corsairTenant(await ensureCorsairTenant(userId));
    // Warm the cache with the latest inbox page (cheap on a warm cache), then
    // read the whole flagged set from Postgres — the cache spans every page
    // the user has browsed, so this sees far more than one screen of mail.
    const [labels, listed] = await Promise.all([
      getLabelData(t).catch(() => ({ custom: [], unread: {} })),
      listInboxMessages(t, { limit: 50, userId }).catch(() => ({
        ok: true,
        messages: [] as InboxMessage[],
      })),
    ]);
    labelData = labels;
    if (!listed.ok) redirect("/connect");

    const [rows, doneRows] = await Promise.all([
      prisma.cachedMessage.findMany({
        // Everything flagged as bulk mail, except what's already junked.
        where: {
          userId,
          hasListUnsubscribe: true,
          NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } },
        },
        orderBy: { internalDate: "desc" },
        take: 500,
      }),
      prisma.unsubscribedSender.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    candidates = rows.map((r) => ({
      id: r.gmailMessageId,
      threadId: r.threadId,
      from: r.fromAddr,
      subject: r.subject,
      snippet: r.snippet,
      internalDate: Number(r.internalDate),
      unread: r.unread,
      labelIds: r.labelIds,
      hasListUnsubscribe: true,
    }));
    unsubscribed = doneRows.map((d) => ({
      addr: d.senderAddr,
      name: d.senderName || d.senderAddr,
      method: d.method,
      link: d.link,
      when: formatInTZ(d.createdAt, tz, { month: "short", day: "numeric" }),
    }));
  }

  // Group by sender address, newest message first (rows are already sorted).
  const doneAddrs = new Set(unsubscribed.map((u) => u.addr));
  const bySender = new Map<string, SubscriptionSender>();
  for (const m of candidates) {
    const { name, email } = parseSender(m.from || "");
    const addr = email.toLowerCase();
    if (!addr || doneAddrs.has(addr)) continue;
    const existing = bySender.get(addr);
    if (existing) {
      existing.count += 1;
    } else {
      bySender.set(addr, {
        addr,
        name: name || addr,
        from: m.from,
        count: 1,
        messageId: m.id,
        latestSubject: m.subject,
        latestDate: formatInTZ(new Date(m.internalDate || 0), tz, {
          month: "short",
          day: "numeric",
        }),
      });
    }
  }
  const senders = [...bySender.values()].sort((a, b) => b.count - a.count);

  return (
    <MailNavProvider>
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <MailSidebar custom={labelData.custom} unread={labelData.unread} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl text-(--ink) sm:text-3xl">Subscriptions</h1>
            <p className="mt-0.5 text-sm text-(--muted)">
              {senders.length === 0
                ? "No active newsletters detected"
                : `${senders.length} newsletter ${senders.length === 1 ? "sender" : "senders"} in your recent mail`}
            </p>
          </div>
          <Link
            href="/mail"
            className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to inbox
          </Link>
        </div>

        <MailFolderChips custom={labelData.custom} unread={labelData.unread} />

        <p className="mt-4 rounded-2xl border border-(--line-soft) bg-(--accent-soft)/40 px-4 py-3 text-sm text-(--ink-soft)">
          These senders include an unsubscribe option in their emails. Select the
          ones you&rsquo;re done with — ZenScail unsubscribes for you, no hunting
          for tiny footer links.
        </p>

        <SubscriptionsList senders={senders} />

        {unsubscribed.length > 0 && (
          <div className="mt-8">
            <p className="px-1 pb-2 text-[11px] font-bold tracking-widest text-(--muted) uppercase">
              Already unsubscribed
            </p>
            <ul className="divide-y divide-(--line-soft) overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
              {unsubscribed.map((u) => (
                <li key={u.addr} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <svg className="shrink-0 text-(--accent)" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--ink-soft)">{u.name}</p>
                    <p className="truncate text-xs text-(--muted)">{u.addr}</p>
                  </div>
                  {u.method === "link" && u.link ? (
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-medium text-(--accent) underline hover:text-(--accent-deep)"
                    >
                      Finish in browser ↗
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-(--muted)">{u.when}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
    </MailNavProvider>
  );
}
