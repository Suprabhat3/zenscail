import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireSession } from "@/lib/session";
import { getAppIdentityForUser, isFromMe } from "@/lib/identity";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  getThreadCached,
  markThreadRead,
  extractBodies,
  extractAttachments,
  header,
  type GmailMessage,
} from "@/lib/gmail";
import { formatBytes } from "@/lib/attachments";
import { markThreadReadInCache, putCachedThread } from "@/lib/mailCache";
import { SenderAvatar, parseSender } from "@/components/mail/SenderAvatar";
import { ThreadAiActions } from "@/components/mail/ThreadAiActions";
import { EmailFrame } from "@/components/mail/EmailFrame";
import { SnoozeMenu } from "@/components/mail/SnoozeMenu";
import { SendBar } from "@/components/mail/SendBar";
import { AttachmentsProvider } from "@/components/mail/AttachmentsContext";
import { AttachmentField } from "@/components/mail/AttachmentField";
import { ReplyChips } from "@/components/mail/ReplyChips";
import { FollowUpButton } from "@/components/mail/FollowUpButton";
import { SummaryBanner } from "@/components/mail/SummaryBanner";
import { getFollowUp } from "@/lib/followUp";
import { getEmailSummaryFor } from "@/lib/ai/summary";
import { getUserTimeZone, formatInTZ, partsInTZ } from "@/lib/timezone";

export const metadata = { title: "Thread — ZenScail" };

/** "Thu, 12 Jun 2026 08:13:22 +0530 (IST)" → "Jun 12, 8:13 AM" (raw on parse failure). */
function formatHeaderDate(raw: string, tz: string): string {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw;
  const sameYear = partsInTZ(ms, tz).year === partsInTZ(Date.now(), tz).year;
  return formatInTZ(ms, tz, {
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
  tz,
}: {
  message: GmailMessage;
  defaultOpen: boolean;
  tz: string;
}) {
  const from = header(message.payload, "From");
  const sender = parseSender(from);
  const date = formatHeaderDate(header(message.payload, "Date"), tz);
  const bodies = extractBodies(message.payload);
  const attachments = message.id ? extractAttachments(message.payload) : [];

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

          {attachments.length > 0 && (
            <div className="mt-4 border-t border-(--line-soft) pt-3">
              <p className="mb-2 text-[11px] font-bold tracking-wider text-(--muted) uppercase">
                {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
              </p>
              <ul className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <li key={a.attachmentId}>
                    {/* Downloading bytes requires a Gmail op Corsair doesn't
                        expose, so we link out to the message in Gmail where the
                        attachment can be opened/downloaded directly. */}
                    <a
                      href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.id!)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open “${a.filename}” in Gmail`}
                      className="flex items-center gap-2 rounded-lg border border-(--line) bg-(--bg) px-3 py-2 text-xs text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-(--muted)">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      <span className="max-w-56 truncate">{a.filename}</span>
                      {a.size > 0 && (
                        <span className="text-(--muted)">{formatBytes(a.size)}</span>
                      )}
                      <span className="ml-0.5 flex items-center gap-1 text-(--muted)">
                        <span>Open in Gmail</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                          <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        </svg>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/** Skeleton shown while the thread's AI summary streams in. */
function SummaryBannerSkeleton() {
  return (
    <div className="mt-5 animate-pulse overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      <div className="h-9 border-b border-(--line-soft) bg-(--accent-soft)/30" />
      <div className="space-y-2 px-4 py-3.5">
        <div className="h-3.5 w-3/4 rounded bg-(--line-soft)" />
        <div className="h-3 w-1/2 rounded bg-(--line-soft)" />
      </div>
    </div>
  );
}

/**
 * Streams the AI summary in independently of the rest of the thread — the
 * message bodies paint immediately; this resolves (instantly if pre-generated,
 * a couple of seconds otherwise) and swaps in behind its own Suspense boundary.
 */
async function ThreadSummary({
  userId,
  t,
  messageId,
}: {
  userId: string;
  t: ReturnType<typeof corsairTenant>;
  messageId: string;
}) {
  const summary = await getEmailSummaryFor(userId, t, messageId);
  if (!summary) return null;
  return (
    <div className="mt-5">
      <SummaryBanner data={summary} />
    </div>
  );
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const tz = await getUserTimeZone();
  const identity = await getAppIdentityForUser(session.user.id, session.user);
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const thread = await getThreadCached(t, session.user.id, id);
  if (!thread) redirect("/connect");
  const followUp = await getFollowUp(session.user.id, thread.id ?? id).catch(() => null);
  const messages = thread.messages ?? [];

  // Opening a thread marks it read, so it leaves the unread view and the bold
  // styling in the inbox list. The cache writes are synchronous (so the UI is
  // immediately consistent); the live Gmail call is best-effort and moved to
  // after() so it never blocks the page.
  if (messages.some((m) => (m.labelIds ?? []).includes("UNREAD"))) {
    for (const m of messages) {
      if (m.labelIds) m.labelIds = m.labelIds.filter((l) => l !== "UNREAD");
    }
    const threadId = thread.id ?? id;
    await Promise.all([
      markThreadReadInCache(session.user.id, threadId),
      // Persist the now-read thread so re-opening from cache doesn't re-mark it.
      putCachedThread(session.user.id, threadId, thread),
    ]);
    after(async () => {
      await markThreadRead(t, id).catch(() => {});
    });
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

      {/* At-a-glance AI summary (reuses the inbox hover summary). Streamed in
          its own Suspense boundary so it never blocks the thread painting. */}
      {last?.id && (
        <Suspense fallback={<SummaryBannerSkeleton />}>
          <ThreadSummary userId={session.user.id} t={t} messageId={last.id} />
        </Suspense>
      )}

      {/* Messages — older ones collapsed, latest expanded */}
      <div className="mt-6 space-y-3">
        {messages.map((m, i) => (
          <MessageCard key={m.id ?? i} message={m} defaultOpen={i === messages.length - 1} tz={tz} />
        ))}
      </div>

      {/* Instant AI reply chips */}
      <ReplyChips threadId={thread.id ?? id} />

      {/* Reply form */}
      <form className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) p-5 shadow-(--shadow-card)">
      <AttachmentsProvider>
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
        <div className="mt-3">
          <AttachmentField />
        </div>
        <div className="mt-3 flex items-center justify-end gap-3 sm:justify-between">
          <p className="hidden text-xs text-(--muted) sm:block">Sends from your connected Gmail · Undo for a few seconds.</p>
          <SendBar successHref={`/mail/thread/${thread.id ?? id}`} label="Send reply" />
        </div>
      </AttachmentsProvider>
      </form>
    </div>
  );
}
