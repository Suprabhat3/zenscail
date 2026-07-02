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
 * The only Google scopes our Cloud Console verification submission covers.
 * Corsair's gmail plugin asks for gmail.modify + labels + send + compose, but
 * gmail.modify already covers every operation we make (read, send, trash,
 * label changes), so we narrow the request to it — the consent screen must
 * match the verified scope list exactly or Google rejects the app.
 */
const VERIFIED_SCOPES: Record<ConnectPlugin, string[]> = {
  gmail: ["https://www.googleapis.com/auth/gmail.modify"],
  googlecalendar: ["https://www.googleapis.com/auth/calendar"],
};

/** Replace the scope param on Corsair's Google authorize URL with our verified set. */
function narrowScopes(authorizeUrl: string, plugin: ConnectPlugin): string {
  const url = new URL(authorizeUrl);
  if (url.hostname !== "accounts.google.com" || !url.searchParams.has("scope")) {
    throw new Error(
      `Unexpected authorize URL shape for ${plugin}; refusing to request unverified scopes`,
    );
  }
  url.searchParams.set("scope", VERIFIED_SCOPES[plugin].join(" "));
  return url.toString();
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

  return { url: narrowScopes(authorizeUrl, plugin) };
}
