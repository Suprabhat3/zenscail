/**
 * One-time Corsair provisioning. Idempotent — safe to re-run.
 *
 * Usage:
 *   1. Create a developer key at https://app.corsair.dev/api-keys
 *   2. Put CORSAIR_DEV_KEY=ch_... in .env
 *   3. pnpm provision:corsair
 *   4. Copy the printed CORSAIR_INSTANCE_ID into .env
 */
import { createClient } from "@corsair-dev/app";

const INSTANCE_NAME = "zenscail";

async function main() {
  const apiKey = process.env.CORSAIR_DEV_KEY;
  if (!apiKey) {
    console.error("CORSAIR_DEV_KEY is not set. Create one at https://app.corsair.dev/api-keys");
    process.exit(1);
  }
  const corsair = createClient({ apiKey });

  const { instances } = await corsair.instances.list();
  const existing = instances.find((i) => i.name === INSTANCE_NAME);
  let instanceId: string;
  if (existing) {
    console.log(`Instance "${INSTANCE_NAME}" exists: ${existing.id} (${existing.status})`);
    instanceId = existing.id;
  } else {
    const created = await corsair.instances.create({ name: INSTANCE_NAME });
    console.log(`Created instance "${INSTANCE_NAME}": ${created.id}`);
    console.log(`  mcpHttpUrl:       ${created.mcpHttpUrl}`);
    console.log(`  oauthCallbackUrl: ${created.oauthCallbackUrl}`);
    instanceId = created.id;
  }

  const inst = corsair.instance(instanceId);

  // NOTE on OAuth: Corsair-managed OAuth (`authType: "managed_oauth"`) is NOT
  // available for our developer account — the API returns
  // `managed_oauth_not_configured` even though the catalog reports
  // supportsManagedOAuth=true. So we bring our OWN Google Cloud OAuth app and
  // register it as the plugin ROOT credentials. Requirements in Google Cloud:
  //   - OAuth 2.0 Web client (the GOOGLE_CLIENT_ID/SECRET below)
  //   - Gmail API + Google Calendar API enabled
  //   - Authorized redirect URI = https://api.corsair.dev/oauth/callback
  //   - test users added (while the consent screen is unverified)
  // "cautious" mode is fine for direct tenant.run() calls from our backend.
  const OAUTH_REDIRECT_URL = "https://api.corsair.dev/oauth/callback";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET must be set in .env (your Google Cloud OAuth web client).",
    );
    process.exit(1);
  }

  for (const pluginId of ["gmail", "googlecalendar"] as const) {
    const { plugin, created } = await inst.plugins.upsert(pluginId, {
      mode: "cautious",
      authType: "oauth_2",
    });
    await inst.plugins.credentials.setRoot(pluginId, "client_id", clientId);
    await inst.plugins.credentials.setRoot(pluginId, "client_secret", clientSecret);
    await inst.plugins.credentials.setRoot(pluginId, "redirect_url", OAUTH_REDIRECT_URL);
    console.log(
      `${created ? "Installed" : "Updated"} plugin ${pluginId} (mode=${plugin.mode}) + root OAuth creds set`,
    );
  }

  await inst.runtime.refresh();

  console.log(`\nGoogle OAuth redirect URI to whitelist in GCP: ${OAUTH_REDIRECT_URL}`);
  console.log("Done. Add to .env:");
  console.log(`CORSAIR_INSTANCE_ID=${instanceId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
