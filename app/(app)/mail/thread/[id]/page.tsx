import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAppIdentityForUser, isFromMe } from "@/lib/identity";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  getThreadCached,
  markThreadRead,
  extractBodies,
  header,
  type GmailMessage,
} from "@/lib/gmail";
import { markThreadReadInCache, putCachedThread } from "@/lib/mailCache";
import { SenderAvatar, parseSender } from "@/components/mail/SenderAvatar";
import { ThreadAiActions } from "@/components/mail/ThreadAiActions";
import { EmailFrame } from "@/components/mail/EmailFrame";
import { SnoozeMenu } from "@/components/mail/SnoozeMenu";
import { SendBar } from "@/components/mail/SendBar";
import { ReplyChips } from "@/components/mail/ReplyChips";
import { FollowUpButton } from "@/components/mail/FollowUpButton";
import { getFollowUp } from "@/lib/followUp";

export const metadata = { title: "Thread — ZenScail" };

/** "Thu, 12 Jun 2026 08:13:22 +0530 (IST)" → "Jun 12, 8:13 AM" (raw on parse failure). */
function formatHeaderDate(raw: string): string {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw;
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageCard({
  message,
  defaultOpen,
}: {
  message: GmailMessage;
  defaultOpen: boolean;
}) {
  const from = header(message.payload, "From");
  const sender = parseSender(from);
  const date = formatHeaderDate(header(message.payload, "Date"));
  const bodies = extractBodies(message.payload);

  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)"
    >
      <summary className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition select-none hover:bg-(--bg) [&::-webkit-details-marker]:hidden">
        <SenderAvatar from={from} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold text-(--ink)">{sender.name}</span>
            <span className="shrink-0 text-xs text-(--muted)">{date}</span>
          </span>
          <span className="block truncate text-xs text-(--muted)">
            {sender.email !== sender.name ? sender.email : ""}
            <span className="group-open:hidden"> · {message.snippet}</span>
          </span>
        </span>
        <svg
          className="shrink-0 text-(--muted) transition-transform group-open:rotate-180"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-(--line-soft)">
        <div className="px-5 pt-2.5 text-xs text-(--muted)">
          To: {header(message.payload, "To")}
        </div>
        <div className="px-5 pt-3 pb-5">
          {bodies.html ? (
            <EmailFrame html={bodies.html} title={`message-${message.id}`} />
          ) : (
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-(--ink-soft)">
              {bodies.text || message.snippet}
            </pre>
          )}
        </div>
      </div>
    </details>
  );
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const identity = await getAppIdentityForUser(session.user.id, session.user);
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const thread = await getThreadCached(t, session.user.id, id);
  if (!thread) redirect("/connect");
  const followUp = await getFollowUp(session.user.id, thread.id ?? id).catch(() => null);
  const messages = thread.messages ?? [];

  // Opening a thread marks it read, so it leaves the unread view and the bold
  // styling in the inbox list. Best-effort — never block the page on it. Mirror
  // the change into the local cache so the inbox row updates without a re-fetch.
  if (messages.some((m) => (m.labelIds ?? []).includes("UNREAD"))) {
    for (const m of messages) {
      if (m.labelIds) m.labelIds = m.labelIds.filter((l) => l !== "UNREAD");
    }
    await Promise.all([
      markThreadRead(t, id).catch(() => {}),
      markThreadReadInCache(session.user.id, thread.id ?? id),
      // Persist the now-read thread so re-opening from cache doesn't re-mark it.
      putCachedThread(session.user.id, thread.id ?? id, thread),
    ]);
  }

  if (messages.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="font-serif text-2xl text-(--ink)">This conversation is empty</p>
        <p className="mt-2 text-sm text-(--muted)">
          It may have been deleted or moved outside your inbox.
        </p>
        <Link
          href="/mail"
          className="mt-6 inline-block rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
        >
          Back to inbox
        </Link>
      </div>
    );
  }
  const last = messages[messages.length - 1];
  const lastFrom = header(last?.payload, "From");
  const lastMessageId = header(last?.payload, "Message-ID");
  const subject = header(messages[0]?.payload, "Subject") || "(no subject)";
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  const replyTo =
    header(last?.payload, "Reply-To") ||
    (isFromMe(lastFrom, identity) ? header(last?.payload, "To") : lastFrom);

  const participants = Array.from(
    new Set(messages.map((m) => parseSender(header(m.payload, "From")).name).filter(Boolean)),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/mail"
        className="inline-flex items-center gap-1.5 text-sm text-(--muted) transition hover:text-(--ink)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m12 19-7-7 7-7M5 12h14" />
        </svg>
        Back to inbox
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-tight text-(--ink)">{subject}</h1>
          <p className="mt-1.5 text-sm text-(--muted)">
            {messages.length} message{messages.length === 1 ? "" : "s"} ·{" "}
            {participants.slice(0, 3).join(", ")}
            {participants.length > 3 ? ` +${participants.length - 3} more` : ""}
          </p>
        </div>
      </div>

      {/* Actions bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ThreadAiActions subject={subject} from={parseSender(lastFrom).name} />
        <SnoozeMenu threadId={thread.id ?? id} />
        <FollowUpButton
          threadId={thread.id ?? id}
          active={
            followUp
              ? { status: followUp.status, remindAt: followUp.remindAt.toISOString() }
              : null
          }
        />
        <Link
          href={`/calendar/new?summary=${encodeURIComponent(subject)}&description=${encodeURIComponent(`From email thread with ${lastFrom}`)}`}
          className="flex items-center gap-1.5 rounded-full border border-(--line) px-3.5 py-1.5 text-sm font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          Create event
        </Link>
      </div>

      {/* Messages — older ones collapsed, latest expanded */}
      <div className="mt-6 space-y-3">
        {messages.map((m, i) => (
          <MessageCard key={m.id ?? i} message={m} defaultOpen={i === messages.length - 1} />
        ))}
      </div>

      {/* Instant AI reply chips */}
      <ReplyChips threadId={thread.id ?? id} />

      {/* Reply form */}
      <form className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) p-5 shadow-(--shadow-card)">
        <h2 className="flex items-center gap-2 text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 17H4v-5l9.5-9.5a3.54 3.54 0 0 1 5 5L9 17ZM21 21H8" />
          </svg>
          Reply
        </h2>
        <p className="mt-2 text-xs text-(--muted)">
          From <span className="text-(--ink-soft)">{identity.primaryEmail}</span>
        </p>
        <input type="hidden" name="threadId" value={thread.id ?? id} />
        <input type="hidden" name="subject" value={replySubject} />
        <input type="hidden" name="inReplyTo" value={lastMessageId} />
        <label className="mt-4 block text-xs font-semibold text-(--muted)">
          To
          <input
            type="text"
            name="to"
            defaultValue={replyTo}
            required
            className="mt-1.5 w-full rounded-xl border border-(--line) bg-(--bg) px-4 py-2.5 text-sm text-(--ink) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          />
        </label>
        <textarea
          id="reply-body"
          name="body"
          rows={6}
          required
          placeholder="Write your reply…"
          className="mt-3 w-full resize-y rounded-xl border border-(--line) bg-(--bg) px-4 py-3 text-sm leading-relaxed text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
        />
        <div className="mt-3 flex items-center justify-end gap-3 sm:justify-between">
          <p className="hidden text-xs text-(--muted) sm:block">Sends from your connected Gmail · Undo for a few seconds.</p>
          <SendBar successHref={`/mail/thread/${thread.id ?? id}`} label="Send reply" />
        </div>
      </form>
    </div>
  );
}
