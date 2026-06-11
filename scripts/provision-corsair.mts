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

  // Managed OAuth: Corsair hosts the Google OAuth app, so we don't need our
  // own client_id/client_secret. "cautious" mode is fine for direct tenant.run()
  // calls from our backend; revisit per-operation overrides before demo if MCP
  // approval prompts get in the way.
  for (const pluginId of ["gmail", "googlecalendar"] as const) {
    const { plugin, created } = await inst.plugins.upsert(pluginId, {
      mode: "cautious",
      authType: "oauth_2",
      useManaged: true,
    });
    console.log(`${created ? "Installed" : "Updated"} plugin ${pluginId} (mode=${plugin.mode}, managed=${plugin.useManaged})`);
  }

  await inst.runtime.refresh();

  console.log("\nDone. Add to .env:");
  console.log(`CORSAIR_INSTANCE_ID=${instanceId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
