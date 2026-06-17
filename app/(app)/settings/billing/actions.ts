"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cancelSubscription, fetchSubscription } from "@/lib/razorpay";
import { isActiveStatus } from "@/lib/subscription";

/**
 * Cancel the user's Cloud subscription at the end of the paid period. They keep
 * Cloud until `currentEnd`; Razorpay stops it renewing. No refund is owed.
 */
export async function cancelCloudSubscription() {
  const session = await requireSession();

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { razorpaySubscriptionId: true, status: true },
  });
  if (!sub?.razorpaySubscriptionId || !isActiveStatus(sub.status)) {
    redirectBack("error=nothing-to-cancel");
  }

  try {
    const remote = await cancelSubscription(sub!.razorpaySubscriptionId, true);
    const currentEnd = remote.current_end ? new Date(remote.current_end * 1000) : undefined;
    await prisma.subscription.update({
      where: { userId: session.user.id },
      data: {
        cancelAtPeriodEnd: true,
        ...(remote.status ? { status: remote.status } : {}),
        ...(currentEnd ? { currentEnd } : {}),
      },
    });
  } catch {
    redirectBack("error=cancel-failed");
  }

  revalidatePath("/settings/billing");
  redirectBack("done=cancelled");
}

/**
 * Switch an active Cloud subscriber who is currently on BYOK back to the Cloud
 * tier. No payment — they already have a live subscription. Refuses if there
 * isn't an active subscription to fall back on.
 */
export async function switchToCloudTier() {
  const session = await requireSession();

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });
  if (!isActiveStatus(sub?.status)) {
    redirectBack("error=no-active-sub");
  }

  await prisma.userAiSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, tier: "cloud" },
    update: { tier: "cloud" },
  });

  revalidatePath("/settings/billing");
  revalidatePath("/settings/ai");
  redirectBack("done=switched-cloud");
}

/**
 * Re-sync the local subscription row from Razorpay. A small "refresh" the user
 * can hit if a renewal/cancel just happened and the webhook is lagging.
 */
export async function refreshSubscription() {
  const session = await requireSession();
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { razorpaySubscriptionId: true },
  });
  if (sub?.razorpaySubscriptionId) {
    try {
      const remote = await fetchSubscription(sub.razorpaySubscriptionId);
      await prisma.subscription.update({
        where: { userId: session.user.id },
        data: {
          status: remote.status,
          currentEnd: remote.current_end ? new Date(remote.current_end * 1000) : null,
          cancelAtPeriodEnd: Boolean(remote.has_scheduled_changes),
        },
      });
    } catch {
      // best-effort; the webhook will reconcile.
    }
  }
  revalidatePath("/settings/billing");
  redirectBack("done=refreshed");
}

// redirect() throws to unwind, so each action calls it as its last statement.
function redirectBack(query: string): never {
  redirect(`/settings/billing?${query}`);
}
