import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { listInboxMessages } from "@/lib/gmail";
import { reconcileInboxWindow } from "@/lib/mailCache";
import { classifyMessages } from "@/lib/ai/classify";
import { summarizeMessages } from "@/lib/ai/summary";
import { syncCalendarWindow } from "@/lib/gcal";

export const maxDuration = 300;

// Small concurrency cap — each user's sync makes several 5-10s Corsair calls,
// so we don't want to hammer Corsair even if the user base grows.
const CONCURRENCY = 3;
const ACTIVE_WITHIN_MS = 7 * 86400_000;

async function warmInbox(userId: string, t: ReturnType<typeof corsairTenant>): Promise<void> {
  const result = await listInboxMessages(t, { userId, limit: 25, labelIds: ["INBOX"] });
  if (!result.ok) return;
  await reconcileInboxWindow(
    userId,
    "INBOX",
    result.messages.map((m) => m.id),
  );
  await classifyMessages(userId, result.messages);
  await summarizeMessages(userId, t, result.messages);
}

async function syncUser(userId: string, tenantId: string): Promise<void> {
  const t = corsairTenant(tenantId);
  await Promise.allSettled([warmInbox(userId, t), syncCalendarWindow(t, userId)]);
}

/**
 * Background sync cron (see docker/cron-entrypoint.sh): keeps every recently
 * active user's mail + calendar cache warm independent of an open tab — the
 * 60s client pollers (MailPoller/CalendarPoller) only run while someone is
 * actually viewing a page. Secured with CRON_SECRET (bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      corsairTenantId: { not: null },
      updatedAt: { gte: new Date(Date.now() - ACTIVE_WITHIN_MS) },
    },
    select: { id: true, corsairTenantId: true },
  });

  let synced = 0;
  let failed = 0;
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((u) => syncUser(u.id, u.corsairTenantId!)),
    );
    for (const r of results) {
      if (r.status === "fulfilled") synced++;
      else failed++;
    }
  }

  return Response.json({ users: users.length, synced, failed });
}
