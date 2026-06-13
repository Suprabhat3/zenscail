import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook ingest auth.
 *
 * Corsair's hosted webhook delivery is configured per instance/tenant in the
 * Corsair dashboard (the installed SDK, @corsair-dev/app@0.1.5, exposes no
 * registration RPC, and the newer `processWebhook` helper that verifies the
 * provider signature is not in this version). So we authenticate inbound
 * deliveries ourselves with a per-tenant token in the URL — the pattern
 * Corsair's own docs recommend ("add a hashed tenant ID as a query parameter
 * to your webhook URL"). The token is an HMAC of the tenant id keyed by
 * APP_SECRET: it identifies the tenant AND proves the URL came from us (an
 * attacker can't forge it without the secret).
 *
 * Upgrade path: when @corsair-dev/app ships `processWebhook`, swap the token
 * check for it to also verify the provider's payload signature.
 */

function secret(): string {
  const value = process.env.APP_SECRET;
  if (!value) throw new Error("Missing required environment variable: APP_SECRET");
  return value;
}

/** Deterministic, non-reversible token identifying a tenant in webhook URLs. */
export function webhookToken(tenantId: string): string {
  return createHmac("sha256", secret()).update(`webhook:${tenantId}`).digest("hex");
}

/** Constant-time check that `token` is the valid token for `tenantId`. */
export function verifyWebhookToken(tenantId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = webhookToken(tenantId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/**
 * The full webhook delivery URL to register for a tenant in the Corsair
 * dashboard. `base` should be the public origin (ngrok tunnel in dev, the
 * deployed origin in prod) — falls back to BETTER_AUTH_URL.
 */
export function webhookUrlForTenant(tenantId: string, base?: string): string {
  const origin = (base ?? process.env.PUBLIC_WEBHOOK_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "")
    .replace(/\/$/, "");
  const url = new URL(`${origin}/api/webhooks/corsair`);
  url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("token", webhookToken(tenantId));
  return url.toString();
}
