"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { prisma } from "@/lib/prisma";
import { modifyThread } from "@/lib/gmail";
import { deliverScheduledSend } from "@/lib/scheduledSend";
import { wakeDueSnoozes } from "@/lib/snooze";
import { publish } from "@/lib/realtime";

// --- Snooze ---

/** Remove a thread from the inbox until `untilIso`; the wake cron restores it. */
export async function snoozeThread(threadId: string, untilIso: string) {
  if (!threadId) throw new Error("threadId required");
  const until = new Date(untilIso);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    throw new Error("Snooze time must be in the future");
  }

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

type SendPayload = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  threadId?: string;
  inReplyTo?: string;
};

function validate(p: SendPayload): SendPayload {
  const to = p.to?.trim();
  const body = p.body ?? "";
  if (!to) throw new Error("Recipient is required");
  if (!body.trim()) throw new Error("Message body is required");
  return {
    to,
    cc: p.cc?.trim() || undefined,
    subject: p.subject?.trim() ?? "",
    body,
    isHtml: Boolean(p.isHtml),
    threadId: p.threadId?.trim() || undefined,
    inReplyTo: p.inReplyTo?.trim() || undefined,
  };
}

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
  const data = validate(payload);
  const userId = await currentUserId();
  const secs = Math.max(0, Math.min(120, Math.round(windowSecs)));
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
  return { id: row.id };
}

/** Queue a "send later" at an explicit time. */
export async function scheduleSend(
  payload: SendPayload,
  sendAtIso: string,
): Promise<{ id: number }> {
  const data = validate(payload);
  const sendAt = new Date(sendAtIso);
  if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be in the future");
  }
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
  revalidatePath("/mail");
  return { id: row.id };
}

/** Cancel a pending send (Undo, or the outbox Cancel button). */
export async function cancelScheduledSend(id: number): Promise<{ canceled: boolean }> {
  const session = await requireSession();
  // Guard on pending + ownership so we can't cancel an already-sent mail.
  const res = await prisma.scheduledSend.updateMany({
    where: { id, userId: session.user.id, status: "pending" },
    data: { status: "canceled" },
  });
  revalidatePath("/mail");
  return { canceled: res.count > 0 };
}

/** Flush one pending send immediately (called by the client when the undo
 * window elapses, so we don't wait for the coarse cron). Ownership-checked. */
export async function flushScheduledSend(id: number): Promise<void> {
  const session = await requireSession();
  const row = await prisma.scheduledSend.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!row) return;
  await deliverScheduledSend(id);
  revalidatePath("/mail");
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
