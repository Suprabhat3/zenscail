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
3. Permissions — modes (verified from SDK types, the web doc summary was wrong): `open` (all allowed) | `cautious` (writes require approval, default) | `strict` (reads only, writes require approval) | `readonly` (writes blocked). Per-operation override policies: `allow` | `deny` | `require_approval`.
   ```ts
   await inst.plugins.permissions.setMode("gmail", "strict");
   await inst.plugins.permissions.setOverride("gmail", "api.send", "deny");
   await inst.plugins.permissions.deleteOverride("gmail", "api.send");
   ```
4. **Managed OAuth (preferred):** `gmail` and `googlecalendar` support `supportsManagedOAuth` — Corsair hosts the Google OAuth app, no Google Cloud project needed:
   ```ts
   await inst.plugins.upsert("gmail", { mode: "cautious", authType: "oauth_2", useManaged: true });
   ```
   Only if bringing our own OAuth app: `inst.plugins.credentials.setRoot("gmail", "client_id" | "client_secret" | "redirect_url" | "topic_id", ...)`.
5. After config changes: `await inst.runtime.refresh()` (or check `inst.runtime.status()` → `{ warm, dbOk }`).

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

SDK facts (verified in `@corsair-dev/app@0.1.5` types):
- `RunResult<T>` = `{ success: true, data: T } | { success: false, signInLink: string }`.
- `t.mcp.config()` returns a `CorsairMcpConfig` for any adapter; `t.mcp.createVercelClient()` lazily imports the Vercel peer dep.
- Errors throw `CorsairApiError { status, code, details }` on non-2xx.
- Gmail account-level credential fields include `webhook_signature` (relevant for Phase 6 webhook verification); gmail root fields include `topic_id` (Pub/Sub, only for self-managed OAuth).
- In this repo: `lib/corsair.ts` (client + `corsairTenant()` + `runOrThrow()`), `scripts/provision-corsair.mts` (`pnpm provision:corsair`), `scripts/corsair-status.mts` (health check).
- The package is **ESM-only** (`exports` has only an `import` condition). Standalone scripts must be `.mts` (plain `.ts` under tsx runs as CJS and fails with ERR_PACKAGE_PATH_NOT_EXPORTED). Imports from Next.js code are fine.

Verified live (2026-06-12, instance `fddeb0a0c5d24d29a39ccfe9b90f2f0d`):
- `tenants.create(id)` throws `CorsairApiError` 409 `tenant_already_exists` on re-create — handle it (see `lib/tenant.ts`).
- **`db.*` reads succeed even for tenants that never connected OAuth** (they query Corsair's local cache and return empty). To check whether a tenant is connected, probe an `api.*` op (e.g. `gmail.api.labels.list`, `googlecalendar.api.events.getMany` — both accept no input) and check `result.success`.
- Managed OAuth: plugins were upserted with `useManaged: true` but the API echoes `useManaged=undefined`; connect links are issued fine. Confirm end-to-end Google OAuth on first real connect.

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

Per-operation schemas: `https://api.corsair.dev/md/integrations/<dotted.operation.path>` (e.g. `.../gmail.api.messages.list`).

### Verified operation schemas (fetched 2026-06-12)

- `gmail.api.messages.list` input: `{ userId?, q?, maxResults?, pageToken?, labelIds?, includeSpamTrash? }` → `{ messages?: GmailMessage[], nextPageToken?, resultSizeEstimate? }`. GmailMessage = `{ id, threadId, labelIds, snippet, historyId, internalDate, sizeEstimate, payload: { mimeType, filename, headers: {name,value}[], body: { attachmentId?, size?, data? }, parts: nested }, raw? }`.
- `gmail.api.messages.send` input: `{ raw: string (REQUIRED), userId?, threadId? }`. **`raw` must be a full RFC 2822 MIME message, base64url-encoded** (`+`→`-`, `/`→`_`, no `=` padding). No structured to/subject/body fields. Pass `threadId` for replies.
- `gmail.api.threads.get` input: `{ id: string (required), userId?, format?: "minimal"|"full"|"metadata", metadataHeaders?: string[] }` → `{ id, snippet, historyId, messages: GmailMessage[] }`.
- `gmail.db.messages.search` filterable fields: `entity_id, id, threadId, snippet, historyId, internalDate, sizeEstimate, raw, subject, body, from, to, createdAt`. String ops: `equals|contains|startsWith|endsWith|in`; number: `equals|gt|gte|lt|lte|in`; date: `equals|before|after|between`. Call shape: `{ data: { field: { op: value } }, limit, offset }`. Note: cached rows have flattened `subject/from/to/body` columns (richer than the thread cache).
- `gmail.db.threads.search` filterable: `entity_id, id, snippet, historyId, createdAt` only — message cache is more useful for inbox lists.

### Verified calendar operation schemas (fetched 2026-06-12)

- `googlecalendar.db.events.search` filterable fields: `entity_id, id, htmlLink, created, updated, summary, description, location, colorId, endTimeUnspecified, recurringEventId, iCalUID, sequence, attendeesOmitted, hangoutLink, calendarId, createdAt` (+ guest/lock booleans). **No start/end dateTime filters** — date-range filtering must be done in app code after fetching cached rows. `created`/`updated` are plain strings (contains/startsWith etc., no date ops).
- `googlecalendar.db.calendars.search` filterable: `entity_id, id, summary, description, location, timeZone, createdAt`.
- `googlecalendar.api.events.create` input: `{ calendarId? (default "primary"), event: { summary?, description?, location?, start?: {date?|dateTime?, timeZone?}, end?: {...}, attendees?: [{email?, displayName?, optional?, responseStatus?, ...}], recurrence?: string[], reminders?, visibility?, status?, ... }, sendUpdates?: "all"|"externalOnly"|"none", sendNotifications?, conferenceDataVersion?, maxAttendees? }`. Provide at minimum summary/start/end. Use `sendUpdates: "all"` so attendees get invite emails. Output is the full event (id, htmlLink, attendees, ...).
- `googlecalendar.api.events.update` input: same as create plus required `id`. Note: behaves like a Google `update` (full replace semantics) — send the complete event body.
- `googlecalendar.api.events.delete` input: `{ id (required), calendarId?, sendUpdates?, sendNotifications? }` → void. Marked DESTRUCTIVE.
- `googlecalendar.api.events.getMany` input: `{ calendarId?, timeMin?, timeMax?, timeZone?, singleEvents?, maxResults?, pageToken?, q?, orderBy?: "startTime"|"updated", showDeleted? }` → `{ items?: GcalEvent[], nextPageToken?, timeZone?, ... }`. `orderBy: "startTime"` requires `singleEvents: true` (Google API rule).
- `googlecalendar.api.calendar.getAvailability` input: `{ timeMin (required), timeMax (required), timeZone?, items?: [{id}] }` → `{ calendars?: { [id]: { busy: [{start,end}] } }, ... }` (the `calendars` map is untyped `{}` in the schema; Google freebusy shape assumed — verify with live data).

## Env vars convention

```
CORSAIR_DEV_KEY=...
CORSAIR_INSTANCE_ID=...
```

Tenant IDs are per-user — store them in our own DB, don't hardcode.
