import "server-only";

import { createClient, CorsairApiError, type TenantScope } from "@corsair-dev/app";

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

/**
 * True when an error from `t.run(...)` means the tenant's OAuth grant is dead
 * and the user must reconnect — e.g. the Google refresh token expired or was
 * revoked ("invalid_grant" / "Token has been expired or revoked"), or the API
 * rejected the call as unauthorized. Corsair normally returns
 * `{ success: false }` for a disconnected plugin, but a failed *token refresh*
 * is thrown as a CorsairApiError, so we sniff both shapes.
 */
export function isReconnectRequiredError(err: unknown): boolean {
  if (err instanceof CorsairApiError && (err.status === 401 || err.status === 403)) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /refresh access token|invalid_grant|expired or revoked|token has been expired|unauthorized|not connected/i.test(
    message,
  );
}

/**
 * Scope Corsair calls to one app user. Tenant IDs are our own user IDs.
 *
 * The returned scope wraps `run` so a *thrown* auth/refresh failure (dead
 * OAuth grant) is downgraded to the same `{ success: false }` result Corsair
 * returns for a disconnected plugin. That way every existing
 * `if (!result.success) redirect("/connect")` / `ok: false` path handles a
 * revoked token uniformly, instead of the error bubbling to the route error
 * boundary as a raw 500.
 */
export function corsairTenant(tenantId: string): TenantScope {
  const tenant = corsairInstance().tenant(tenantId);
  return new Proxy(tenant, {
    get(target, prop) {
      if (prop !== "run") {
        // Bind methods to the real target so private fields keep working.
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return async <T = unknown>(path: string, input?: Record<string, unknown>) => {
        try {
          return await target.run<T>(path, input);
        } catch (err) {
          if (isReconnectRequiredError(err)) {
            return { success: false as const, signInLink: "" };
          }
          throw err;
        }
      };
    },
  });
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
