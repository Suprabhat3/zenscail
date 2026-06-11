"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  refreshMessages,
  sendEmail,
  trashMessage,
  modifyMessage,
} from "@/lib/gmail";

async function tenantForCurrentUser() {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  return corsairTenant(tenantId);
}

export async function refreshInbox() {
  const t = await tenantForCurrentUser();
  const result = await refreshMessages(t);
  if (!result.success) redirect("/connect");
  revalidatePath("/mail");
}

export async function sendMessage(formData: FormData) {
  const t = await tenantForCurrentUser();
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const text = String(formData.get("body") ?? "");
  const threadId = String(formData.get("threadId") ?? "") || undefined;
  const inReplyTo = String(formData.get("inReplyTo") ?? "") || undefined;
  if (!to || !text) throw new Error("Recipient and body are required");

  const result = await sendEmail(t, {
    to,
    subject,
    text,
    threadId,
    inReplyTo,
    references: inReplyTo,
  });
  if (!result.success) redirect("/connect");
  revalidatePath("/mail");
  redirect(threadId ? `/mail/thread/${threadId}` : "/mail");
}

export async function trashMessageAction(formData: FormData) {
  const t = await tenantForCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const result = await trashMessage(t, id);
  if (!result.success) redirect("/connect");
  revalidatePath("/mail");
}

export async function archiveMessageAction(formData: FormData) {
  const t = await tenantForCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const result = await modifyMessage(t, id, { removeLabelIds: ["INBOX"] });
  if (!result.success) redirect("/connect");
  revalidatePath("/mail");
}

export async function markReadAction(formData: FormData) {
  const t = await tenantForCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await modifyMessage(t, id, { removeLabelIds: ["UNREAD"] });
  revalidatePath("/mail");
}
