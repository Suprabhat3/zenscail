"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  refreshMessages,
  sendEmail,
  trashMessage,
  modifyMessage,
} from "@/lib/gmail";
import {
  dropCachedMessage,
  dropCachedMessages,
  dropCachedThread,
  markMessagesReadInCache,
} from "@/lib/mailCache";
import { parseFormData } from "@/lib/validation";

/** Optional form text: an empty/absent field becomes `undefined`, never `""`. */
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const SendMessageSchema = z.object({
  to: z.string().trim().min(1, "Recipient and body are required"),
  subject: z.string().trim().default(""),
  body: z.string().min(1, "Recipient and body are required"),
  threadId: optionalText,
  inReplyTo: optionalText,
});

const MessageIdSchema = z.object({ id: z.string().min(1) });

const BundleSchema = z.object({
  ids: z.array(z.string()),
  op: z.enum(["read", "archive"]),
});

async function sessionAndTenant() {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  return { userId: session.user.id, t: corsairTenant(tenantId) };
}

async function tenantForCurrentUser() {
  return (await sessionAndTenant()).t;
}

export async function refreshInbox() {
  const t = await tenantForCurrentUser();
  const result = await refreshMessages(t);
  if (!result.success) redirect("/connect");
  revalidatePath("/mail");
}

export async function sendMessage(formData: FormData) {
  const { userId, t } = await sessionAndTenant();
  const { to, subject, body: text, threadId, inReplyTo } = parseFormData(
    formData,
    SendMessageSchema,
  );

  const result = await sendEmail(t, {
    to,
    subject,
    text,
    threadId,
    inReplyTo,
    references: inReplyTo,
  });
  if (!result.success) redirect("/connect");
  // The reply adds a message to the thread — drop the cached copy so the next
  // open re-fetches the full conversation including what we just sent.
  if (threadId) await dropCachedThread(userId, threadId);
  revalidatePath("/mail");
  redirect(threadId ? `/mail/thread/${threadId}` : "/mail");
}

export async function trashMessageAction(formData: FormData) {
  const { userId, t } = await sessionAndTenant();
  const parsed = MessageIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const { id } = parsed.data;
  const result = await trashMessage(t, id);
  if (!result.success) redirect("/connect");
  await dropCachedMessage(userId, id);
  revalidatePath("/mail");
}

export async function archiveMessageAction(formData: FormData) {
  const { userId, t } = await sessionAndTenant();
  const parsed = MessageIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const { id } = parsed.data;
  const result = await modifyMessage(t, id, { removeLabelIds: ["INBOX"] });
  if (!result.success) redirect("/connect");
  // Archived = no longer in INBOX; drop it so it leaves the cached inbox list.
  await dropCachedMessage(userId, id);
  revalidatePath("/mail");
}

export async function markReadAction(formData: FormData) {
  const { userId, t } = await sessionAndTenant();
  const parsed = MessageIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const { id } = parsed.data;
  await modifyMessage(t, id, { removeLabelIds: ["UNREAD"] });
  await markMessagesReadInCache(userId, [id]);
  revalidatePath("/mail");
}

/** Batch action over a bundle: mark every message read or archive them all. */
export async function bundleAction(ids: string[], op: "read" | "archive") {
  const parsed = BundleSchema.parse({ ids, op });
  const clean = parsed.ids.filter(Boolean);
  if (clean.length === 0) return { ok: true };
  const { userId, t } = await sessionAndTenant();
  const mods =
    parsed.op === "archive"
      ? { removeLabelIds: ["INBOX"] }
      : { removeLabelIds: ["UNREAD"] };
  const results = await Promise.allSettled(
    clean.map((id) => modifyMessage(t, id, mods)),
  );
  const failed = results.some(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
  );
  // Mirror into the local cache: archived rows leave the inbox; read clears dots.
  if (op === "archive") await dropCachedMessages(userId, clean);
  else await markMessagesReadInCache(userId, clean);
  revalidatePath("/mail");
  return { ok: !failed };
}
