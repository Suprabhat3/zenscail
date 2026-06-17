"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type DraftInput = {
  /** Existing draft id to update; omit/empty to create a new one. */
  id?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  isHtml?: boolean;
  threadId?: string;
  inReplyTo?: string;
};

function clean(p: DraftInput) {
  return {
    to: p.to?.trim() ?? "",
    cc: p.cc?.trim() || null,
    subject: p.subject?.trim() ?? "",
    body: p.body ?? "",
    isHtml: Boolean(p.isHtml),
    threadId: p.threadId?.trim() || null,
    inReplyTo: p.inReplyTo?.trim() || null,
  };
}

/**
 * Create or update a draft for the current user. Called by the composer's
 * debounced autosave and the manual "Save draft" button. Returns the draft id
 * so the client can keep updating the same row. An empty draft (no recipient,
 * subject, or body) is not persisted — autosave fires before the user types.
 */
export async function saveDraft(input: DraftInput): Promise<{ id: string | null }> {
  const session = await requireSession();
  const userId = session.user.id;
  const data = clean(input);

  if (!data.to && !data.subject && !data.body.trim() && !data.cc) {
    return { id: input.id ?? null };
  }

  if (input.id) {
    // Ownership-guarded update; falls through to create if the id isn't ours.
    const res = await prisma.draft.updateMany({
      where: { id: input.id, userId },
      data,
    });
    if (res.count > 0) {
      revalidatePath("/mail");
      return { id: input.id };
    }
  }

  const row = await prisma.draft.create({
    data: { userId, ...data },
    select: { id: true },
  });
  revalidatePath("/mail");
  return { id: row.id };
}

/** Delete a draft (manual discard, or after the mail actually sends). */
export async function deleteDraft(id: string): Promise<void> {
  if (!id) return;
  const session = await requireSession();
  await prisma.draft.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/mail");
}
