import { prisma } from "@/lib/prisma";
import { generateDailyBrief, dateKey } from "@/lib/ai/brief";

export const maxDuration = 300;

/**
 * Daily 9am cron (see vercel.json): generate today's brief for every user
 * who has connected Corsair. Secured with CRON_SECRET — Vercel Cron sends it
 * as `Authorization: Bearer <CRON_SECRET>` automatically.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { corsairTenantId: { not: null } },
    select: { id: true },
  });

  const today = dateKey();
  const results = { generated: 0, skipped: 0, failed: 0 };

  // Sequential on purpose: avoids hammering Corsair + LLM rate limits when
  // the user base grows. Skips users who already have today's brief.
  for (const user of users) {
    const existing = await prisma.dailyBrief.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
      select: { id: true },
    });
    if (existing) {
      results.skipped++;
      continue;
    }
    try {
      await generateDailyBrief(user.id);
      results.generated++;
    } catch (err) {
      console.error(`daily-summary: failed for user ${user.id}:`, err);
      results.failed++;
    }
  }

  return Response.json({ date: today, users: users.length, ...results });
}
