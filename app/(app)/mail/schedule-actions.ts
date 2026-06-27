"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { prisma } from "@/lib/prisma";
import { modifyThread } from "@/lib/gmail";
import { deliverScheduledSend } from "@/lib/scheduledSend";
import { wakeDueSnoozes } from "@/lib/snooze";
import { publish } from "@/lib/realtime";
import { clampedInt } from "@/lib/validation";
import { outgoingAttachmentsSchema } from "@/lib/attachments";

/** A future instant parsed from an ISO string — rejects invalid or past times. */
const futureDate = (message: string) =>
  z.coerce.date().refine((d) => d.getTime() > Date.now(), { error: message });

/** A scheduled-send row id (positive integer). */
const rowIdSchema = z.coerce.number().int().positive();

const SnoozeSchema = z.object({
  threadId: z.string().min(1, "threadId required"),
  until: futureDate("Snooze time must be in the future"),
});

const SendPayloadSchema = z.object({
  to: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Recipient is required"),
  cc: z
    .string()
    .optional()
    .transform((s) => s?.trim() || undefined),
  subject: z
    .string()
    .optional()
    .transform((s) => s?.trim() ?? ""),
  // Kept verbatim (not trimmed) but must contain non-whitespace.
  body: z.string().refine((s) => s.trim().length > 0, "Message body is required"),
  isHtml: z
    .boolean()
    .optional()
    .transform((v) => Boolean(v)),
  threadId: z
    .string()
    .optional()
    .transform((s) => s?.trim() || undefined),
  inReplyTo: z
    .string()
    .optional()
    .transform((s) => s?.trim() || undefined),
  // Optional file attachments (base64) carried with the queued send.
  attachments: outgoingAttachmentsSchema.optional(),
});

/** The shape callers hand us (pre-validation). */
type SendPayload = z.input<typeof SendPayloadSchema>;

/** Persist a send's attachment rows (base64 → bytea) for a created row. */
async function createAttachmentRows(
  scheduledSendId: number,
  attachments: z.infer<typeof outgoingAttachmentsSchema> | undefined,
): Promise<void> {
  if (!attachments?.length) return;
  await prisma.scheduledSendAttachment.createMany({
    data: attachments.map((a) => {
      const content = Buffer.from(a.dataBase64, "base64");
      return {
        scheduledSendId,
        filename: a.filename,
        mimeType: a.mimeType,
        content,
        size: content.length,
      };
    }),
  });
}

// --- Snooze ---

/** Remove a thread from the inbox until `untilIso`; the wake cron restores it. */
export async function snoozeThread(threadId: string, untilIso: string) {
  const { until } = SnoozeSchema.parse({ threadId, until: untilIso });

  const session = await requireSession();
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const result = await modifyThread(t, threadId, { removeLabelIds: ["INBOX"] });
  if (!result.success) redirect("/connect");

  await prisma.snoozedThread.upsert({
    where: { userId_threadId: { userId, threadId } },
    create: { userId, threadId, snoozeUntil: until },
    update: { snoozeUntil: until },
  });

  revalidatePath("/mail");
}

/** Bring a snoozed thread back to the inbox right now (manual un-snooze). */
export async function unsnoozeThread(threadId: string) {
  const session = await requireSession();
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const result = await modifyThread(t, threadId, { addLabelIds: ["INBOX"] });
  if (!result.success) redirect("/connect");

  await prisma.snoozedThread.deleteMany({ where: { userId, threadId } });
  publish(userId, { plugin: "gmail", type: "snooze-wake", at: Date.now() });
  revalidatePath("/mail");
}

// --- Scheduled / deferred send ---

async function currentUserId(): Promise<string> {
  const session = await requireSession();
  // Ensure the tenant exists up front so delivery never races provisioning.
  await ensureCorsairTenant(session.user.id);
  return session.user.id;
}

/**
 * Deferred send for the Undo window: queue the mail to go out in `windowSecs`
 * seconds and return the row id so the client can flush it when the toast
 * elapses (or cancel it on Undo). The cron is the backstop if the tab closes.
 */
export async function deferSend(
  payload: SendPayload,
  windowSecs: number,
): Promise<{ id: number }> {
  const data = SendPayloadSchema.parse(payload);
  const userId = await currentUserId();
  const secs = clampedInt(0, 0, 120).parse(windowSecs);
  const row = await prisma.scheduledSend.create({
    data: {
      userId,
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      body: data.body,
      isHtml: data.isHtml ?? false,
      threadId: data.threadId,
      inReplyTo: data.inReplyTo,
      sendAt: new Date(Date.now() + secs * 1000),
      isUndo: true,
    },
    select: { id: true },
  });
  await createAttachmentRows(row.id, data.attachments);
  return { id: row.id };
}

/** Queue a "send later" at an explicit time. */
export async function scheduleSend(
  payload: SendPayload,
  sendAtIso: string,
): Promise<{ id: number }> {
  const data = SendPayloadSchema.parse(payload);
  const sendAt = futureDate("Scheduled time must be in the future").parse(sendAtIso);
  const userId = await currentUserId();
  const row = await prisma.scheduledSend.create({
    data: {
      userId,
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      body: data.body,
      isHtml: data.isHtml ?? false,
      threadId: data.threadId,
      inReplyTo: data.inReplyTo,
      sendAt,
      isUndo: false,
    },
    select: { id: true },
  });
  await createAttachmentRows(row.id, data.attachments);
  revalidatePath("/mail");
  return { id: row.id };
}

/** Cancel a pending send (Undo, or the outbox Cancel button). */
export async function cancelScheduledSend(id: number): Promise<{ canceled: boolean }> {
  const rowId = rowIdSchema.parse(id);
  const session = await requireSession();
  // Guard on pending + ownership so we can't cancel an already-sent mail.
  const res = await prisma.scheduledSend.updateMany({
    where: { id: rowId, userId: session.user.id, status: "pending" },
    data: { status: "canceled" },
  });
  // Free the queued attachment bytes — the row lingers (status canceled) so the
  // onDelete cascade never fires for it.
  if (res.count > 0) {
    await prisma.scheduledSendAttachment.deleteMany({
      where: { scheduledSendId: rowId },
    });
  }
  revalidatePath("/mail");
  return { canceled: res.count > 0 };
}

/** Flush one pending send immediately (called by the client when the undo
 * window elapses, so we don't wait for the coarse cron). Ownership-checked.
 * Returns the delivery outcome so the client can surface a failed send instead
 * of silently reporting success. */
export async function flushScheduledSend(
  id: number,
): Promise<"sent" | "failed" | "skipped"> {
  const rowId = rowIdSchema.parse(id);
  const session = await requireSession();
  const row = await prisma.scheduledSend.findFirst({
    where: { id: rowId, userId: session.user.id },
    select: { id: true },
  });
  if (!row) return "skipped";
  const outcome = await deliverScheduledSend(rowId);
  revalidatePath("/mail");
  return outcome;
}

/**
 * Opportunistic catch-up the inbox can call on render: wake due snoozes and
 * flush any overdue sends for the current user. Cheap no-op when nothing's due;
 * makes the app work even where cron cadence is coarse (e.g. Vercel Hobby).
 */
export async function catchUpSchedules(): Promise<void> {
  const session = await requireSession();
  const userId = session.user.id;
  await Promise.allSettled([
    wakeDueSnoozes({ userId }),
    (async () => {
      const due = await prisma.scheduledSend.findMany({
        where: { userId, status: "pending", sendAt: { lte: new Date() } },
        select: { id: true },
        take: 50,
      });
      for (const { id } of due) await deliverScheduledSend(id);
    })(),
  ]);
}
