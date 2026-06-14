import { processDueFollowUps } from "@/lib/followUp";

export const maxDuration = 120;

/**
 * Follow-up cron (see vercel.json): for every armed follow-up past its remind
 * time, check whether a reply arrived — clear it if so, otherwise surface it
 * (one-time realtime nudge). Secured with CRON_SECRET (Vercel sends it as
 * `Authorization: Bearer <secret>`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { replied, surfaced } = await processDueFollowUps();
  return Response.json({ replied, surfaced });
}
