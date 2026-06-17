"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { isValidModel, type AiProvider } from "@/lib/ai/models";
import {
  createSubscription,
  verifyCheckoutSignature,
  fetchSubscription,
  razorpayConfigured,
  razorpayKeyId,
} from "@/lib/razorpay";
import { isActiveStatus } from "@/lib/subscription";
import { CLOUD_PLAN } from "@/lib/plan";
import { sendCloudReceiptEmail } from "@/lib/email/send";

const PROVIDER_IDS = ["openai", "anthropic", "google", "groq"] as const;

function parseProvider(value: string): AiProvider {
  if (!(PROVIDER_IDS as readonly string[]).includes(value)) {
    throw new Error(`Unknown provider: ${value}`);
  }
  return value as AiProvider;
}

/**
 * Finish onboarding on the BYOK path: save the encrypted key and mark the user
 * onboarded. A valid key is required (Cloud is otherwise fully gated), so we
 * never complete onboarding without one.
 */
export async function finishByok(formData: FormData) {
  const session = await requireSession();

  const provider = parseProvider(String(formData.get("provider") ?? ""));
  const model = String(formData.get("model") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (!isValidModel(provider, model)) throw new Error(`Unknown model for ${provider}: ${model}`);
  if (!apiKey) redirect("/onboarding?step=ai&error=key");

  await prisma.userAiSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      tier: "byok",
      provider,
      model,
      encryptedApiKey: encryptSecret(apiKey),
    },
    update: { tier: "byok", provider, model, encryptedApiKey: encryptSecret(apiKey) },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardedAt: new Date() },
  });

  redirect("/dashboard");
}

/**
 * Switch a (re)activating Cloud user back to BYOK from the subscribe step.
 *
 * A reactivating user is `tier="cloud"` without an active subscription, so the
 * app gate and the onboarding page both pin them to the subscribe step — they
 * can't simply navigate to `?step=ai`. Flipping the tier here lifts that gate.
 * If they already have a stored key (e.g. they switched BYOK→Cloud and changed
 * their mind) they're ready to go; otherwise send them to AI settings to add one.
 */
export async function switchToByok() {
  const session = await requireSession();

  const settings = await prisma.userAiSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, tier: "byok" },
    update: { tier: "byok" },
  });

  // Reactivating users are already onboarded, so flipping the tier is enough to
  // lift the Cloud gate. If they have a stored key they're ready; otherwise send
  // them to AI settings to add one.
  redirect(settings.encryptedApiKey ? "/dashboard" : "/settings/ai");
}

/**
 * Create a Razorpay subscription for the Cloud plan and persist it as `created`.
 * Returns the ids the browser needs to open Checkout. Onboarding is NOT marked
 * complete here — only after the payment is verified.
 */
export async function startCloudSubscription(): Promise<{
  subscriptionId: string;
  keyId: string;
}> {
  const session = await requireSession();
  if (!razorpayConfigured()) {
    throw new Error("Razorpay is not configured on this server.");
  }

  const sub = await createSubscription({
    notes: { userId: session.user.id, email: session.user.email },
  });

  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      razorpaySubscriptionId: sub.id,
      razorpayPlanId: sub.plan_id,
      status: sub.status,
    },
    update: {
      razorpaySubscriptionId: sub.id,
      razorpayPlanId: sub.plan_id,
      status: sub.status,
    },
  });

  return { subscriptionId: sub.id, keyId: razorpayKeyId() };
}

/**
 * Verify the Checkout signature, then confirm the subscription is live with
 * Razorpay before granting access. On success, set tier=cloud + onboardedAt.
 */
export async function verifyCloudSubscription(args: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): Promise<{ ok: boolean }> {
  const session = await requireSession();

  const signatureOk = verifyCheckoutSignature(args);
  if (!signatureOk) return { ok: false };

  // Confirm against Razorpay (don't trust the client's word on status).
  let status = "active";
  let currentEnd: Date | null = null;
  try {
    const remote = await fetchSubscription(args.subscriptionId);
    status = remote.status;
    currentEnd = remote.current_end ? new Date(remote.current_end * 1000) : null;
  } catch {
    // Signature already verified; fall back to optimistic active and let the
    // webhook reconcile the real status.
  }

  // Guard: the subscription must belong to this user (we created it with their id).
  const existing = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { razorpaySubscriptionId: true },
  });
  if (existing && existing.razorpaySubscriptionId !== args.subscriptionId) {
    return { ok: false };
  }

  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      razorpaySubscriptionId: args.subscriptionId,
      status,
      currentEnd,
    },
    update: { status, currentEnd },
  });

  await prisma.userAiSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, tier: "cloud" },
    update: { tier: "cloud" },
  });

  if (isActiveStatus(status)) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardedAt: new Date() },
    });

    // Payment receipt — best-effort; never block Cloud access on a mail hiccup.
    try {
      await sendCloudReceiptEmail({
        to: session.user.email,
        name: session.user.name ?? undefined,
        amount: CLOUD_PLAN.price,
        currency: CLOUD_PLAN.currency,
        interval: CLOUD_PLAN.interval,
        renewsOn: currentEnd,
      });
    } catch (err) {
      console.warn("Cloud receipt email skipped:", err);
    }
  }

  return { ok: isActiveStatus(status) };
}
