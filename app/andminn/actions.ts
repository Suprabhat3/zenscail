"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  adminGrantSubscriptionId,
  requireAdmin,
} from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { isActiveStatus } from "@/lib/subscription";

const userIdSchema = z.string().min(1);

/** Grant ZenScail Cloud without Razorpay — tier + active subscription row. */
export async function grantCloudAccess(formData: FormData) {
  await requireAdmin();
  const userId = userIdSchema.parse(formData.get("userId"));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { connectedEmail: true, onboardedAt: true },
  });
  if (!user) return;

  // Admin grants are a one-month trial of Cloud — not a year. When it lapses
  // the date-aware access check (lib/subscription) revokes access automatically;
  // the user re-subscribes from /settings/billing.
  const currentEnd = new Date();
  currentEnd.setMonth(currentEnd.getMonth() + 1);

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        razorpaySubscriptionId: adminGrantSubscriptionId(userId),
        status: "active",
        currentEnd,
        cancelAtPeriodEnd: false,
        cloudCelebratedAt: null,
      },
      update: {
        status: "active",
        currentEnd,
        cancelAtPeriodEnd: false,
        // Re-arm the celebration so a re-grant is celebrated again.
        cloudCelebratedAt: null,
      },
    }),
    prisma.userAiSettings.upsert({
      where: { userId },
      create: { userId, tier: "cloud" },
      update: { tier: "cloud" },
    }),
    ...(user.connectedEmail && !user.onboardedAt
      ? [
          prisma.user.update({
            where: { id: userId },
            data: { onboardedAt: new Date() },
          }),
        ]
      : []),
  ]);

  // Push to the user's open tabs (onboarding/app) so the celebration fires in
  // ~1s without a manual refresh. In-process bus — reliable on the single-
  // instance deploy; the client's poll fallback covers the rare miss.
  publish(userId, { channel: "subscription", type: "granted", at: Date.now() });

  revalidatePath("/andminn");
}

/** Revoke admin-granted or paid Cloud access. */
export async function revokeCloudAccess(formData: FormData) {
  await requireAdmin();
  const userId = userIdSchema.parse(formData.get("userId"));

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (!sub || !isActiveStatus(sub.status)) return;

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: "expired",
      cancelAtPeriodEnd: false,
    },
  });

  revalidatePath("/andminn");
}

/** Switch a user's AI tier preference (cloud vs byok). */
export async function setUserTier(formData: FormData) {
  await requireAdmin();
  const userId = userIdSchema.parse(formData.get("userId"));
  const tier = String(formData.get("tier") ?? "") === "byok" ? "byok" : "cloud";

  if (tier === "cloud") {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (!isActiveStatus(sub?.status)) return;
  }

  await prisma.userAiSettings.upsert({
    where: { userId },
    create: { userId, tier },
    update: { tier },
  });

  revalidatePath("/andminn");
}
