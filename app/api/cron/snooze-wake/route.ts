import { wakeDueSnoozes } from "@/lib/snooze";

export const maxDuration = 60;

/**
 * Wake cron (see vercel.json): re-surface every snoozed thread whose time has
 * come. Secured with CRON_SECRET (Vercel sends `Authorization: Bearer <secret>`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { woken } = await wakeDueSnoozes();
  return Response.json({ woken });
}
