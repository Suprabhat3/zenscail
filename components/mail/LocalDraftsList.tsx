"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDraft } from "@/app/(app)/mail/draft-actions";
import { useToast } from "@/components/ui/Toast";

export type LocalDraft = {
  id: string;
  to: string;
  subject: string;
  preview: string;
  isHtml: boolean;
  updatedAt: string;
};

/**
 * The user's database-backed drafts, shown above the Gmail DRAFT-label list in
 * the Drafts folder. Each row reopens the composer pre-filled; the trash icon
 * deletes the draft.
 */
export function LocalDraftsList({ drafts }: { drafts: LocalDraft[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = drafts.filter((d) => !hidden.has(d.id));
  if (visible.length === 0) return null;

  function onDelete(id: string) {
    setHidden((s) => new Set(s).add(id));
    startTransition(async () => {
      await deleteDraft(id).catch(() => {});
      toast("Draft deleted");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      <div className="flex items-center gap-2 border-b border-(--line-soft) px-4 py-2.5 sm:px-5">
        <span className="text-xs font-bold tracking-wider text-(--muted) uppercase">
          Saved on ZenScail
        </span>
        <span className="rounded-full bg-(--bg) px-2 py-0.5 text-[11px] font-medium text-(--muted)">
          {visible.length}
        </span>
      </div>
      <ul className="divide-y divide-(--line-soft)">
        {visible.map((d) => (
          <li
            key={d.id}
            className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-(--bg) sm:px-5"
          >
            <button
              type="button"
              onClick={() => router.push(`/mail/compose?draft=${d.id}`)}
              className="min-w-0 flex-1 text-left focus:outline-none"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-(--ink)">
                  {d.to || "(no recipient)"}
                  {d.isHtml && (
                    <span className="ml-2 rounded bg-(--accent-soft) px-1.5 py-0.5 text-[10px] font-semibold text-(--accent)">
                      Styled
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-(--muted)">{d.updatedAt}</span>
              </div>
              <div className="mt-0.5 truncate text-sm text-(--ink-soft)">
                <span className="text-(--ink)">{d.subject || "(no subject)"}</span>
                {d.preview && <span className="text-(--muted)"> — {d.preview}</span>}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(d.id)}
              title="Delete draft"
              className="shrink-0 rounded-full p-2 text-(--muted) opacity-0 transition hover:bg-(--accent-soft) hover:text-(--accent) group-hover:opacity-100"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
