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
  // Reply goes to the last sender unless that's us — then to the original recipients.
  const replyTo =
    header(last?.payload, "Reply-To") ||
    (lastFrom.includes(session.user.email) ? header(last?.payload, "To") : lastFrom);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/mail" className="text-sm text-neutral-400 hover:text-neutral-200">
        ← Back to inbox
      </Link>
      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl">{subject}</h1>
        <Link
          href={`/calendar/new?summary=${encodeURIComponent(subject)}&description=${encodeURIComponent(`From email thread with ${lastFrom}`)}`}
          className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          Create event from this email
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {messages.map((m) => {
          const bodies = extractBodies(m.payload);
          return (
            <article key={m.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-neutral-200">{header(m.payload, "From")}</span>
                <span className="text-xs text-neutral-500">{header(m.payload, "Date")}</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">To: {header(m.payload, "To")}</div>
              <div className="mt-4">
                {bodies.html ? (
                  <iframe
                    srcDoc={bodies.html}
                    sandbox=""
                    className="h-96 w-full rounded-lg border border-neutral-800 bg-white"
                    title={`message-${m.id}`}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-300">
                    {bodies.text || m.snippet}
                  </pre>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <form action={sendMessage} className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Reply</h2>
        <input type="hidden" name="threadId" value={thread.id ?? id} />
        <input type="hidden" name="subject" value={replySubject} />
        <input type="hidden" name="inReplyTo" value={lastMessageId} />
        <input
          type="text"
          name="to"
          defaultValue={replyTo}
          required
          className="mt-3 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
        />
        <textarea
          name="body"
          rows={5}
          required
          placeholder="Write your reply…"
          className="mt-3 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <button className="mt-3 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white">
          Send reply
        </button>
      </form>
    </div>
  );
}
