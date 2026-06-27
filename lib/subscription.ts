import "server-only";

import { prisma } from "@/lib/prisma";

/** Razorpay statuses that grant active Cloud access. */
const ACTIVE_STATUSES = new Set(["active", "authenticated"]);

export function isActiveStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

/**
 * Whether the subscription grants Cloud access *right now*. Unlike
 * `isActiveStatus`, this also enforces the paid period: an active row whose
 * `currentEnd` has passed (e.g. an admin grant that lapsed, or a Razorpay
 * period that wasn't renewed) no longer counts. A null `currentEnd` is treated
 * as non-expiring so legacy rows without a period aren't locked out.
 */
export function hasCloudAccess(
  sub: { status: string; currentEnd: Date | null } | null | undefined,
): boolean {
  if (!isActiveStatus(sub?.status)) return false;
  const end = sub?.currentEnd ?? null;
  return !end || end.getTime() > Date.now();
}

/** Whether the user currently has an active Cloud subscription. */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, currentEnd: true },
  });
  return hasCloudAccess(sub);
}

/**
 * Map the row to whether the user may use the Cloud tier right now.
 * Used by the (app) gate and the AI registry.
 */
export function cloudAccessFrom(
  sub: { status: string; currentEnd: Date | null } | null | undefined,
): boolean {
  return hasCloudAccess(sub);
}

export type BillingState = {
  /** What the app currently runs AI on. */
  tier: "cloud" | "byok";
  /** A Subscription row exists at all. */
  hasSubscription: boolean;
  /** Raw Razorpay status mirror. */
  status: string | null;
  /** Subscription currently grants Cloud access. */
  isActive: boolean;
  /** Cancellation scheduled — active until `currentEnd`, then stops. */
  cancelAtPeriodEnd: boolean;
  /** End of the paid period (renewal date, or final access date if cancelling). */
  currentEnd: Date | null;
  /** Whole days from now until `currentEnd` (>= 0), or null if unknown. */
  daysRemaining: number | null;
};

/** Everything the Billing page needs in one query. */
export async function getBillingState(userId: string): Promise<BillingState> {
  const [aiSettings, sub] = await Promise.all([
    prisma.userAiSettings.findUnique({
      where: { userId },
      select: { tier: true },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, currentEnd: true, cancelAtPeriodEnd: true },
    }),
  ]);

  const currentEnd = sub?.currentEnd ?? null;
  const daysRemaining = currentEnd
    ? Math.max(0, Math.ceil((currentEnd.getTime() - Date.now()) / 86_400_000))
    : null;

  return {
    tier: aiSettings?.tier === "byok" ? "byok" : "cloud",
    hasSubscription: Boolean(sub),
    status: sub?.status ?? null,
    isActive: hasCloudAccess(sub),
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    currentEnd,
    daysRemaining,
  };
}
