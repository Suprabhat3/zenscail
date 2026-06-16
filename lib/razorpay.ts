import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Thin Razorpay client over the REST API + Node crypto for signatures, so we
 * don't pull in the SDK. All money is handled in the smallest currency unit
 * (paise for INR); the actual amount charged is defined by the Razorpay Plan
 * (RAZORPAY_PLAN_ID), created once in the Razorpay dashboard.
 */

const API_BASE = "https://api.razorpay.com/v1";

// Re-export so server code keeps a single import site, but the source of truth
// is the client-safe lib/plan.ts (this module is server-only).
export { CLOUD_PLAN } from "@/lib/plan";

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_PLAN_ID,
  );
}

/** Public key id — safe to expose to the browser for Checkout. */
export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  current_end: number | null;
  short_url?: string;
};

/**
 * Create a monthly subscription against the configured plan. `total_count` is
 * the max number of billing cycles Razorpay will attempt — set high so it runs
 * until the user cancels (Razorpay requires a finite count).
 */
export async function createSubscription(opts: {
  notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
  const res = await fetch(`${API_BASE}/subscriptions`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      total_count: 120, // 10 years of monthly cycles; effectively "until cancelled"
      customer_notify: 1,
      notes: opts.notes ?? {},
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay createSubscription failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RazorpaySubscription;
}

export async function fetchSubscription(id: string): Promise<RazorpaySubscription> {
  const res = await fetch(`${API_BASE}/subscriptions/${id}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    throw new Error(`Razorpay fetchSubscription failed (${res.status})`);
  }
  return (await res.json()) as RazorpaySubscription;
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Verify the Checkout handler payload for a subscription payment.
 * signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret).
 */
export function verifyCheckoutSignature(args: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const expected = createHmac("sha256", secret)
    .update(`${args.paymentId}|${args.subscriptionId}`)
    .digest("hex");
  return safeEqualHex(expected, args.signature);
}

/**
 * Verify an inbound webhook body against the X-Razorpay-Signature header.
 * signature = HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
