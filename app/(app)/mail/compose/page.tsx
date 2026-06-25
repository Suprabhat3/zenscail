import Link from "next/link";
import { requireAppIdentity } from "@/lib/identity";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RecipientField } from "@/components/mail/RecipientField";
import { SendBar } from "@/components/mail/SendBar";
import { RichComposer } from "@/components/mail/RichComposer";
import { AttachmentsProvider } from "@/components/mail/AttachmentsContext";
import { AttachmentField } from "@/components/mail/AttachmentField";

export const metadata = { title: "Compose — ZenScail" };

const bareInput =
  "flex-1 bg-transparent py-2 text-sm text-(--ink) placeholder:text-(--muted) focus:outline-none";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{
    to?: string;
    subject?: string;
    body?: string;
    html?: string;
    draft?: string;
  }>;
}) {
  const { to, subject, body, html, draft } = await searchParams;
  const { identity } = await requireAppIdentity();
  const me = identity.primaryEmail;

  // Load a saved draft when reopened from the Drafts folder; URL params (e.g. an
  // AI-prepared compose) take precedence when present.
  let saved: { id: string; to: string; cc: string | null; subject: string; body: string; isHtml: boolean } | null =
    null;
  if (draft) {
    const session = await requireSession();
    saved = await prisma.draft.findFirst({
      where: { id: draft, userId: session.user.id },
      select: { id: true, to: true, cc: true, subject: true, body: true, isHtml: true },
    });
  }

  const initialTo = to ?? saved?.to ?? "";
  const initialSubject = subject ?? saved?.subject ?? "";
  const initialBody = body ?? saved?.body ?? "";
  const initialIsHtml = html === "1" || (body == null && (saved?.isHtml ?? false));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
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

      <form className="mt-6 overflow-hidden rounded-3xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
        <AttachmentsProvider>
        <div className="px-5 pt-4">
          {/* To — autocompleting recipient field */}
          <div className="flex items-start gap-3 border-b border-(--line-soft) pb-3">
            <label className="w-16 shrink-0 pt-2.5 text-sm font-medium text-(--muted)">To</label>
            <div className="flex-1">
              <RecipientField name="to" required defaultValue={initialTo} placeholder="Start typing a name or email…" />
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
              defaultValue={initialSubject}
              placeholder="Add a subject"
              className={bareInput}
            />
          </div>
        </div>

        {/* Body — Plain (smart-compose ghost text) / Styled (rich HTML + AI Prettify) */}
        <RichComposer
          defaultBody={initialBody}
          defaultIsHtml={initialIsHtml}
          draftId={saved?.id ?? ""}
          subjectId="subject"
          toName="to"
        />

        {/* Attachments */}
        <div className="border-t border-(--line-soft) px-5 py-3">
          <AttachmentField />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-(--line-soft) bg-(--bg)/40 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <SendBar successHref="/mail" />
            <Link
              href="/mail"
              className="rounded-full px-3 py-2.5 text-sm font-medium text-(--muted) transition hover:text-(--ink)"
            >
              Discard
            </Link>
          </div>
          <p className="hidden text-xs text-(--muted) sm:block">
            Sends from your connected Gmail · Undo for a few seconds after sending.
          </p>
        </div>
        </AttachmentsProvider>
      </form>
    </div>
  );
}
