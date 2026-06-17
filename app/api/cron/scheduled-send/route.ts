import { processDueSends } from "@/lib/scheduledSend";

export const maxDuration = 120;

/**
 * Scheduled-send cron (see vercel.json): deliver every pending send that's due.
 * Backstop for both "send later" and the undo-window deferral (the client
 * normally flushes the undo row itself, but this catches closed tabs).
 * Secured with CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await processDueSends();
  return Response.json(result);
}
