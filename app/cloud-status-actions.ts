"use server";

import { getSession } from "@/lib/session";
import { getBillingState } from "@/lib/subscription";

export type CloudStatus = {
  signedIn: boolean;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  /** ISO string for safe client serialization, or null. */
  currentEnd: string | null;
};

/**
 * Public, non-throwing subscription status for the marketing pricing card.
 * Returns `signedIn: false` for logged-out visitors so the page stays usable.
 */
export async function getMyCloudStatus(): Promise<CloudStatus> {
  const session = await getSession();
  if (!session) {
    return { signedIn: false, isActive: false, cancelAtPeriodEnd: false, currentEnd: null };
  }
  const s = await getBillingState(session.user.id);
  return {
    signedIn: true,
    isActive: s.isActive,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    currentEnd: s.currentEnd ? s.currentEnd.toISOString() : null,
  };
}
