import Link from "next/link";
import { requireSession } from "@/lib/session";
import { RecipientField } from "@/components/mail/RecipientField";
import { sendMessage } from "../actions";

export const metadata = { title: "Compose — ZenScail" };

const fieldLabel = "w-16 shrink-0 pt-2.5 text-sm font-medium text-(--muted)";
const bareInput =
  "flex-1 bg-transparent py-2 text-sm text-(--ink) placeholder:text-(--muted) focus:outline-none";

export default async function ComposePage() {
  const session = await requireSession();
  const me = session.user.email;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/mail" className="text-sm text-(--muted) transition hover:text-(--ink)">
        ← Back to inbox
      </Link>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-normal tracking-tight text-(--ink)">
            New message
          </h1>
          <p className="mt-0.5 text-sm text-(--muted)">
            From <span className="text-(--ink-soft)">{me}</span>
          </p>
        </div>
      </div>

      <form
        action={sendMessage}
        className="mt-6 overflow-hidden rounded-3xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)"
      >
        <div className="px-5 pt-4">
          {/* To — autocompleting recipient field */}
          <div className="flex items-start gap-3 border-b border-(--line-soft) pb-3">
            <label className={fieldLabel}>To</label>
            <div className="flex-1">
              <RecipientField name="to" required placeholder="Start typing a name or email…" />
            </div>
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3 border-b border-(--line-soft)">
            <label htmlFor="subject" className="w-16 shrink-0 text-sm font-medium text-(--muted)">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              name="subject"
              placeholder="Add a subject"
              className={bareInput}
            />
          </div>
        </div>

        {/* Body */}
        <textarea
          name="body"
          rows={13}
          required
          placeholder="Write your message…"
          className="w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-(--ink) placeholder:text-(--muted) focus:outline-none"
        />

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-(--line-soft) bg-(--bg)/40 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
              Send
            </button>
            <Link
              href="/mail"
              className="rounded-full px-3 py-2.5 text-sm font-medium text-(--muted) transition hover:text-(--ink)"
            >
              Discard
            </Link>
          </div>
          <p className="hidden text-xs text-(--muted) sm:block">
            Recipients get your message straight from Gmail.
          </p>
        </div>
      </form>
    </div>
  );
}
