# Corsair Reference (fetched 2026-06-11)

Cached summary of the Corsair docs so agents don't need to re-fetch. Sources: docs.corsair.dev, api.corsair.dev/md/integrations.

## Installation & client

```bash
npm install @corsair-dev/app
```

```ts
import { createClient } from "@corsair-dev/app";
const corsair = createClient({ apiKey: process.env.CORSAIR_DEV_KEY! });
```

Developer API key is created at https://app.corsair.dev/api-keys.

## Provisioning flow (one-time, scripted)

1. Create an instance — always reference by **id**, never display name:
   ```ts
   const { id } = await corsair.instances.create({ name: "zenscail" });
   const inst = corsair.instance(id);
   ```
2. Install plugins:
   ```ts
   await inst.plugins.upsert("gmail", { mode: "cautious" });
   await inst.plugins.upsert("googlecalendar", { mode: "cautious" });
   ```
3. Permissions — modes: `permissive` | `cautious` | `strict`, plus per-operation overrides:
   ```ts
   await inst.plugins.permissions.setMode("gmail", "strict");
   await inst.plugins.permissions.setOverride("gmail", "api.send", "deny");
   await inst.plugins.permissions.deleteOverride("gmail", "api.send");
   ```
4. Root OAuth credentials (instance-level, shared Google OAuth app):
   ```ts
   await inst.plugins.upsert("gmail", { authType: "oauth_2" });
   await inst.plugins.credentials.setRoot("gmail", "client_id", "...");
   await inst.plugins.credentials.setRoot("gmail", "client_secret", "...");
   ```

## Tenants & auth (per user)

A tenant = one user/workspace; isolates credentials and MCP keys.

```ts
const tenant = await inst.tenants.create("user_123"); // your own ID or auto-generated
const t = inst.tenant(tenant.id);
```

Two ways to connect a user's Google account:

- **Connect link** (preferred, self-service browser flow):
  ```ts
  const { url } = await t.connectLink.create({
    plugins: ["gmail", "googlecalendar"],
    ttlMs: 30 * 60 * 1000,
  });
  ```
- **Direct OAuth authorize URL** (custom redirect back into the app):
  ```ts
  const { authorizeUrl } = await t.plugins.oauth.authorizeUrl(
    "gmail",
    "https://myapp.com/integrations/done",
  );
  ```
  Tokens persist automatically on callback.

Direct credential set (for API-key plugins): `t.plugins.credentials.set(plugin, field, value)`.

## Direct execution: `tenant.run()`

Two path families:

- **`.db.*`** — read-only queries against Corsair's synced/cached database. Use for UI feeds, lists, searches (fast, no rate limits).
- **`.api.*`** — live third-party API calls. Use for writes and cache refreshes.

> Design the UI to read from `.db` on every render and call `.api` only when the user asks to refresh or when performing a write.

```ts
// read cached
await t.run("gmail.db.messages.search", { data: {...}, limit: 100, offset: 0 });
// refresh cache
await t.run("gmail.api.messages.list");
// write
await t.run("gmail.api.messages.send", {...});
```

Missing auth doesn't throw — it returns a result object:

```ts
const result = await t.run("gmail.api.messages.list");
if (!result.success) redirect(result.signInLink);
```

## Agent SDK wiring (Vercel AI SDK)

```bash
npm install @corsair-dev/app ai @ai-sdk/mcp
```

Method 1 — developer key, backend:
```ts
const mcpClient = await corsair
  .instance(process.env.CORSAIR_INSTANCE_ID!)
  .tenant(tenantId)
  .mcp.createVercelClient();

const stream = streamText({
  model,                       // any AI SDK model
  tools: await mcpClient.tools(),   // MUST await before passing
  stopWhen: stepCountIs(15),
  prompt,
});
```

Method 2 — tenant MCP key:
```ts
const key = await corsair.instance(id).tenant(tid).mcpKeys.create("vercel-agent");
const mcpClient = await createVercelAiMcpClient({ url: key.mcpHttpUrl, apiKey: key.secret });
```

Other SDKs: OpenAI (`getOpenAiMcpConfig` / `createOpenAiMcpServer`), Claude Agent SDK (`claudeMcpServerConfig`). Do NOT add Corsair operation names to the agent system prompt — the MCP server handles discovery.

## Gmail plugin operations (`gmail`)

API (`gmail.api.*`):
- drafts: `create`, `delete`, `get`, `list`, `send`, `update`
- labels: `create`, `delete`, `get`, `list`, `update`
- messages: `batchModify`, `delete`, `get`, `list`, `modify`, `send`, `trash`, `untrash`
- threads: `delete`, `get`, `list`, `modify`, `trash`, `untrash`

DB (`gmail.db.*`): `drafts.search`, `labels.search`, `messages.search`, `threads.search`

Webhooks: `gmail.webhooks.messageChanged` — fires on message activity changes.

## Google Calendar plugin operations (`googlecalendar`)

API (`googlecalendar.api.*`):
- `calendar.getAvailability` — free/busy slots
- events: `create`, `delete`, `get`, `getMany`, `update`

DB (`googlecalendar.db.*`): `calendars.search`, `events.search`

Webhooks: `googlecalendar.webhooks.onEventChanged`

Per-operation schemas: `https://api.corsair.dev/md/integrations/<operation-path>`.

## Env vars convention

```
CORSAIR_DEV_KEY=...
CORSAIR_INSTANCE_ID=...
```

Tenant IDs are per-user — store them in our own DB, don't hardcode.
