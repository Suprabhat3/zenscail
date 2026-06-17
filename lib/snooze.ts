import "server-only";

import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { ensureCorsairTenant } from "@/lib/tenant";
import { modifyThread } from "@/lib/gmail";
import { publish } from "@/lib/realtime";

/**
 * Re-surface every snoozed thread whose time has come: add the INBOX label back
 * and clear the row. Used by the wake cron (all users) or scoped to one user
 * for an opportunistic flush on inbox render. Best-effort per row — a failed
 * Gmail call leaves the row so the next pass retries.
 */
export async function wakeDueSnoozes(opts: { userId?: string } = {}): Promise<{
  woken: number;
}> {
  const due = await prisma.snoozedThread.findMany({
    where: {
      snoozeUntil: { lte: new Date() },
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    take: 200,
  });

  let woken = 0;
  // Tenant scopes are cheap to recreate; group is minor optimisation skipped.
  for (const row of due) {
    try {
      const tenantId = await ensureCorsairTenant(row.userId);
      const t = corsairTenant(tenantId);
      const result = await modifyThread(t, row.threadId, {
        addLabelIds: ["INBOX"],
      });
      if (!result.success) continue; // leave the row; retry next pass
      await prisma.snoozedThread.delete({ where: { id: row.id } });
      publish(row.userId, { plugin: "gmail", type: "snooze-wake", at: Date.now() });
      woken++;
    } catch (err) {
      console.error(`snooze: wake failed for thread ${row.threadId}:`, err);
    }
  }
  return { woken };
}
