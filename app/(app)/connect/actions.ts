"use server";

import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { CONNECT_PLUGINS, type ConnectPlugin } from "./plugins";

function appOrigin(): string {
  const url = process.env.BETTER_AUTH_URL;
  if (!url) throw new Error("Missing required environment variable: BETTER_AUTH_URL");
  return url.replace(/\/+$/, "");
}

/**
 * Direct OAuth authorize URL for a single plugin, returning the user to our
 * own callback page (not a Corsair-hosted page). The callback chains to the
 * next plugin, then closes the popup — so the connect flow stays in our app.
 */
export async function createAuthorizeUrl(
  plugin: ConnectPlugin,
): Promise<{ url: string }> {
  if (!CONNECT_PLUGINS.includes(plugin)) {
    throw new Error(`Unsupported plugin: ${plugin}`);
  }
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);

  const returnTo = `${appOrigin()}/connect/callback?plugin=${plugin}`;
  const { authorizeUrl } = await corsairTenant(tenantId).plugins.oauth.authorizeUrl(
    plugin,
    returnTo,
  );

  return { url: authorizeUrl };
}

/**
 * Create a Corsair-hosted connect link for both plugins. Kept as a fallback
 * for when the popup is blocked — the user opens it in a new tab instead.
 */
export async function createConnectLink(): Promise<{ url: string }> {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);

  const link = await corsairTenant(tenantId).connectLink.create({
    plugins: [...CONNECT_PLUGINS],
    ttlMs: 30 * 60 * 1000,
  });

  return { url: link.url };
}
