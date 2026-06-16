import "server-only";

import { prisma } from "@/lib/prisma";

/** Razorpay statuses that grant active Cloud access. */
const ACTIVE_STATUSES = new Set(["active", "authenticated"]);

export function isActiveStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

/** Whether the user currently has an active Cloud subscription. */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  return isActiveStatus(sub?.status);
}

/**
 * Map the row to whether the user may use the Cloud tier right now.
 * Used by the (app) gate and the AI registry.
 */
export function cloudAccessFrom(sub: { status: string } | null | undefined): boolean {
  return isActiveStatus(sub?.status);
}
