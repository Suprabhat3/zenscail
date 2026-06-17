import "server-only";

import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { ensureCorsairTenant } from "@/lib/tenant";
import { sendEmail } from "@/lib/gmail";
import { wrapComposedEmail } from "@/lib/email/render";
import { publish } from "@/lib/realtime";

/**
 * Core delivery of one scheduled-send row. Idempotent: only acts on rows that
 * are still `pending`, and flips the status under that guard so the cron and a
 * client-side undo flush can never double-send the same row.
 */
export async function deliverScheduledSend(id: number): Promise<
  "sent" | "failed" | "skipped"
> {
  // Atomically claim the row: only proceed if it's still pending. updateMany
  // returns count 0 if another worker (cron vs. client flush) already took it.
  const claim = await prisma.scheduledSend.updateMany({
    where: { id, status: "pending" },
    data: { status: "sending" },
  });
  if (claim.count === 0) return "skipped";

  const row = await prisma.scheduledSend.findUnique({ where: { id } });
  if (!row) return "skipped";

  try {
    const tenantId = await ensureCorsairTenant(row.userId);
    const t = corsairTenant(tenantId);
    const result = await sendEmail(t, {
      to: row.to,
      cc: row.cc ?? undefined,
      subject: row.subject,
      // For HTML drafts `body` is the editor's inline-styled fragment; wrap it
      // in the branded card shell and let buildRawEmail derive the text fallback.
      text: row.isHtml ? "" : row.body,
      html: row.isHtml
        ? wrapComposedEmail({ body: row.body, preheader: row.subject })
        : undefined,
      threadId: row.threadId ?? undefined,
      inReplyTo: row.inReplyTo ?? undefined,
      references: row.inReplyTo ?? undefined,
    });
    if (!result.success) throw new Error("Gmail send returned success:false");

    await prisma.scheduledSend.update({
      where: { id },
      data: { status: "sent", sentAt: new Date(), error: null },
    });
    // Nudge any open mail view to refresh (the sent message lands in the thread).
    publish(row.userId, { plugin: "gmail", type: "scheduled-send", at: Date.now() });
    return "sent";
  } catch (err) {
    await prisma.scheduledSend.update({
      where: { id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    console.error(`scheduledSend: delivery failed for row ${id}:`, err);
    return "failed";
  }
}

/**
 * Process every pending send that is due (sendAt <= now). Used by the cron
 * backstop (all users) and can be scoped to one user for an opportunistic flush.
 */
export async function processDueSends(opts: { userId?: string } = {}): Promise<{
  sent: number;
  failed: number;
}> {
  const due = await prisma.scheduledSend.findMany({
    where: {
      status: "pending",
      sendAt: { lte: new Date() },
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    select: { id: true },
    orderBy: { sendAt: "asc" },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    const outcome = await deliverScheduledSend(id);
    if (outcome === "sent") sent++;
    else if (outcome === "failed") failed++;
  }
  return { sent, failed };
}
