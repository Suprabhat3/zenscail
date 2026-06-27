"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasCloudAccess } from "@/lib/subscription";

export type CloudStatus = {
  signedIn: boolean;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  /** ISO string for safe client serialization, or null. */
  currentEnd: string | null;
  /**
   * The user just gained *usable* Cloud (active + mailbox connected) and hasn't
   * been shown the celebration yet. The client plays the upgrade screen.
   */
  shouldCelebrate: boolean;
  /**
   * Worth polling/listening for a change — i.e. not an established Cloud user
   * who has already been welcomed. Lets the celebration listener go idle.
   */
  keepWatching: boolean;
};

/**
 * Public, non-throwing subscription status for the marketing pricing card and
 * the upgrade-celebration listener. Returns `signedIn: false` for logged-out
 * visitors so the page stays usable.
 */
export async function getMyCloudStatus(): Promise<CloudStatus> {
  const session = await getSession();
  if (!session) {
    return {
      signedIn: false,
      isActive: false,
      cancelAtPeriodEnd: false,
      currentEnd: null,
      shouldCelebrate: false,
      keepWatching: false,
    };
  }

  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { connectedEmail: true },
    }),
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: {
        status: true,
        currentEnd: true,
        cancelAtPeriodEnd: true,
        cloudCelebratedAt: true,
      },
    }),
  ]);

  const isActive = hasCloudAccess(sub);
  // Mailbox connected = the user can actually enter the app. We never celebrate
  // (and route them in) before this, so an upgrade granted mid-onboarding waits
  // until they've connected, then shows the "you're already upgraded" screen.
  const ready = Boolean(user?.connectedEmail);
  const celebrated = Boolean(sub?.cloudCelebratedAt);

  const shouldCelebrate = isActive && ready && !celebrated;
  const keepWatching = !shouldCelebrate && !(isActive && celebrated);

  return {
    signedIn: true,
    isActive,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    currentEnd: sub?.currentEnd ? sub.currentEnd.toISOString() : null,
    shouldCelebrate,
    keepWatching,
  };
}

/**
 * Mark the Cloud welcome celebration as shown so it never replays (across
 * reloads/tabs). Also completes onboarding for the rare case where access was
 * granted before the user finished the wizard. Idempotent.
 */
export async function acknowledgeCloudWelcome(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const now = new Date();
  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: { userId: session.user.id, cloudCelebratedAt: null },
      data: { cloudCelebratedAt: now },
    }),
    prisma.user.updateMany({
      where: { id: session.user.id, onboardedAt: null },
      data: { onboardedAt: now },
    }),
  ]);
}
