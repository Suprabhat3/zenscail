import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { isActiveStatus } from "@/lib/subscription";
import { publish } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RazorpayEventSchema = z.object({
  event: z.string().optional(),
  payload: z
    .object({
      subscription: z
        .object({
          entity: z
            .object({
              id: z.string().optional(),
              status: z.string().optional(),
              current_end: z.number().nullish(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

type RazorpayEvent = z.infer<typeof RazorpayEventSchema>;

/**
 * Razorpay subscription webhook. Keeps our Subscription rows in sync with the
 * source of truth (renewals, halts, cancellations) so Cloud access reflects
 * the real billing state without us polling. Configure this URL + the same
 * RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard, subscribed to the
 * `subscription.*` events.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: RazorpayEvent;
  try {
    event = RazorpayEventSchema.parse(JSON.parse(raw));
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  if (!sub?.id) {
    // Not a subscription event we track — ack so Razorpay stops retrying.
    return Response.json({ ok: true });
  }

  const currentEnd = sub.current_end ? new Date(sub.current_end * 1000) : null;

  try {
    const existing = await prisma.subscription.findFirst({
      where: { razorpaySubscriptionId: sub.id },
      select: { userId: true, status: true },
    });
    if (!existing) return Response.json({ ok: true });

    // Newly active (e.g. the first charge confirmed asynchronously) → re-arm and
    // push so the upgrade celebration plays in the user's open tab. Only on the
    // transition, so routine renewals of an already-active sub don't re-fire it.
    const justActivated =
      isActiveStatus(sub.status) && !isActiveStatus(existing.status);

    await prisma.subscription.updateMany({
      where: { razorpaySubscriptionId: sub.id },
      data: {
        status: sub.status ?? undefined,
        ...(currentEnd ? { currentEnd } : {}),
        ...(justActivated ? { cloudCelebratedAt: null } : {}),
      },
    });

    if (justActivated) {
      publish(existing.userId, {
        channel: "subscription",
        type: "granted",
        at: Date.now(),
      });
    }
  } catch (err) {
    console.error("razorpay webhook: failed to update subscription", err);
    // Still ack — a 500 makes Razorpay retry; the next event will reconcile.
  }

  return Response.json({ ok: true });
}
