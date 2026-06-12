import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getThread, extractBodies, header } from "@/lib/gmail";
import { sendMessage } from "../../actions";

export const metadata = { title: "Thread — ZenScail" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const result = await getThread(t, id);
  if (!result.success) redirect("/connect");
  const thread = result.data;
  const messages = thread.messages ?? [];
  const last = messages[messages.length - 1];
  const lastFrom = header(last?.payload, "From");
  const lastMessageId = header(last?.payload, "Message-ID");
  const subject = header(messages[0]?.payload, "Subject") || "(no subject)";
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  const replyTo =
    header(last?.payload, "Reply-To") ||
    (lastFrom.includes(session.user.email) ? header(last?.payload, "To") : lastFrom);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/mail" className="text-sm text-(--muted) transition hover:text-(--ink)">
        ← Back to inbox
      </Link>

      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-(--ink)">{subject}</h1>
        <Link
          href={`/calendar/new?summary=${encodeURIComponent(subject)}&description=${encodeURIComponent(`From email thread with ${lastFrom}`)}`}
          className="shrink-0 rounded-full border border-(--line) px-3 py-1.5 text-sm text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
        >
          Create event
        </Link>
      </div>

      {/* Messages */}
      <div className="mt-6 space-y-4">
        {messages.map((m) => {
          const bodies = extractBodies(m.payload);
          return (
            <article key={m.id} className="overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
              <div className="flex items-baseline justify-between gap-3 border-b border-(--line-soft) px-5 py-3 text-sm">
                <span className="font-semibold text-(--ink)">{header(m.payload, "From")}</span>
                <span className="text-xs text-(--muted)">{header(m.payload, "Date")}</span>
              </div>
              <div className="px-5 py-1 text-xs text-(--muted)">To: {header(m.payload, "To")}</div>
              <div className="px-5 pb-5 pt-3">
                {bodies.html ? (
                  <iframe
                    srcDoc={bodies.html}
                    sandbox=""
                    className="h-96 w-full rounded-xl border border-(--line-soft) bg-white"
                    title={`message-${m.id}`}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-(--ink-soft)">
                    {bodies.text || m.snippet}
                  </pre>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Reply form */}
      <form action={sendMessage} className="mt-8 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) p-5 shadow-(--shadow-card)">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-(--muted)">Reply</h2>
        <input type="hidden" name="threadId" value={thread.id ?? id} />
        <input type="hidden" name="subject" value={replySubject} />
        <input type="hidden" name="inReplyTo" value={lastMessageId} />
        <input
          type="text"
          name="to"
          defaultValue={replyTo}
          required
          className="mt-3 w-full rounded-full border border-(--line) bg-(--bg) px-4 py-2.5 text-sm text-(--ink) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
        />
        <textarea
          name="body"
          rows={5}
          required
          placeholder="Write your reply…"
          className="mt-3 w-full rounded-xl border border-(--line) bg-(--bg) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
        />
        <button className="mt-3 rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
          Send reply
        </button>
      </form>
    </div>
  );
}
