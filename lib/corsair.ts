import "server-only";

import { createClient, type TenantScope } from "@corsair-dev/app";

declare global {
  var corsairClient: ReturnType<typeof createClient> | undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazy: env vars are only required when a Corsair call is actually made,
// so the app builds and boots before Corsair is provisioned.
export function corsairClient() {
  if (!globalThis.corsairClient) {
    globalThis.corsairClient = createClient({
      apiKey: requireEnv("CORSAIR_DEV_KEY"),
    });
  }
  return globalThis.corsairClient;
}

export function corsairInstance() {
  return corsairClient().instance(requireEnv("CORSAIR_INSTANCE_ID"));
}

/** Scope Corsair calls to one app user. Tenant IDs are our own user IDs. */
export function corsairTenant(tenantId: string): TenantScope {
  return corsairInstance().tenant(tenantId);
}

export class CorsairAuthRequiredError extends Error {
  constructor(public readonly signInLink: string) {
    super("Corsair plugin not connected for this tenant");
    this.name = "CorsairAuthRequiredError";
  }
}

/**
 * Run an operation and unwrap the result. Throws CorsairAuthRequiredError
 * (carrying the connect link) when the tenant hasn't connected the plugin —
 * callers in pages/actions should catch it and redirect to /connect.
 */
export async function runOrThrow<T = unknown>(
  tenant: TenantScope,
  path: string,
  input?: Record<string, unknown>,
): Promise<T> {
  const result = await tenant.run<T>(path, input);
  if (!result.success) {
    throw new CorsairAuthRequiredError(result.signInLink);
  }
  return result.data;
}
