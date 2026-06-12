# ZenScail — Implementation Plan

AI-powered email + calendar management built on Corsair. See [requirement.md](./requirement.md) for the brief and [corsair-reference.md](./corsair-reference.md) for cached Corsair API details (use it instead of re-fetching docs).

## Confirmed decisions

- **Multi-user with real login.** Each app user maps 1:1 to a Corsair tenant.
- **LLM: BYOK multi-provider + cloud default.** Users can bring their own API key for any major provider (OpenAI, Anthropic, Google, etc.) and pick a model — that's the free tier. The cloud (paid/default) tier uses our OpenAI key. Implemented provider-agnostic via the Vercel AI SDK.
- **Bonus scope:** realtime Corsair webhooks, AI email-priority filtering, keyboard shortcuts. (Vector search: out of scope for now.)

## Current state

- Next.js 16.2.9 (App Router, Turbopack, React 19.2) — **read `node_modules/next/dist/docs/` before writing Next code; this version has breaking changes.**
- Prisma 7 + Neon Postgres (`lib/prisma.ts`, single `Waitlist` model), Tailwind 4.
- Marketing landing page only; no auth, no app shell.

## Architecture overview

```
Browser (app shell: /mail, /calendar, /chat)
   │  server actions + route handlers + SSE
Next.js backend
   ├─ Better Auth (Google sign-in) ── User table
   ├─ lib/corsair.ts  → @corsair-dev/app client
   │     tenant(user.corsairTenantId).run("gmail.db.*" reads, "*.api.*" writes)
   ├─ /api/chat → streamText(model from provider registry, tools = Corsair MCP)
   ├─ /api/webhooks/corsair → ingest events → Postgres → SSE push to client
   └─ Prisma/Postgres: users, settings (BYOK keys), email metadata (priority), event log
Corsair (hosted): instance "zenscail", plugins gmail + googlecalendar, one tenant per user
```

Key principle from Corsair docs: **UI reads come from `*.db.*` (cached, fast); `*.api.*` only for writes and explicit refresh.**

---

## Phase 0 — Corsair provisioning & plumbing (foundation)

1. Get a developer key at app.corsair.dev/api-keys → `CORSAIR_DEV_KEY` in `.env`.
2. `npm install @corsair-dev/app`.
3. Write a one-time script `scripts/provision-corsair.ts`:
   - `corsair.instances.create({ name: "zenscail" })` → save id as `CORSAIR_INSTANCE_ID`.
   - `inst.plugins.upsert("gmail", { mode: "cautious" })` and `inst.plugins.upsert("googlecalendar", { mode: "cautious" })`.
   - (If using our own Google OAuth app) set root credentials: `inst.plugins.credentials.setRoot("gmail", "client_id"/"client_secret", ...)`.
4. Create `lib/corsair.ts`: singleton client + `getTenant(user)` helper that returns `corsair.instance(...).tenant(user.corsairTenantId)`.
5. Add a typed wrapper around `t.run()` that checks `result.success` and surfaces `signInLink` for re-auth redirects.

**Deliverable:** a script-run proves we can list Gmail messages for a test tenant.

## Phase 1 — Auth & user → tenant mapping

1. Install **Better Auth** with Google sign-in (check `node_modules/next/dist/docs/01-app/guides/authentication` for current Next 16 patterns).
2. Prisma schema additions (then `prisma migrate`):
   - `User` (id, email, name, image, createdAt)
   - `corsairTenantId String?` on User
   - `Session`/`Account` tables per Better Auth adapter
3. On first sign-in (auth callback / server action): `inst.tenants.create(user.id)` → persist `corsairTenantId`.
4. **Connect flow page `/connect`:** if a Corsair call returns `success: false`, redirect here; create `t.connectLink.create({ plugins: ["gmail", "googlecalendar"], ttlMs: 30*60*1000 })` and show the link/redirect. Alternatively use `t.plugins.oauth.authorizeUrl("gmail", "<app>/connect/done")` for an in-app redirect flow.
5. Route group `(app)` with middleware-protected layout; keep landing page at `/`.

**Deliverable:** sign in with Google → tenant created → Gmail/Calendar connected via connect link.

## Phase 2 — Mail UI (core requirement)

Routes under `(app)/mail`:

1. **Inbox list** — server component reading `gmail.db.threads.search` / `gmail.db.messages.search` (cached, fast). Pagination via `limit`/`offset`. "Refresh" button triggers a server action calling `gmail.api.messages.list` to resync, then revalidates.
2. **Thread view** — `gmail.db.threads.search` for the thread + `gmail.api.threads.get` fallback; render messages, sanitize HTML bodies.
3. **Compose / reply** — modal or `/mail/compose`; server actions:
   - send: `gmail.api.messages.send`
   - save draft: `gmail.api.drafts.create` / `drafts.update`; send draft: `drafts.send`
4. **Actions:** archive/trash (`messages.trash`), restore (`untrash`), mark read/unread + labels (`messages.modify`, `labels.list`), bulk (`messages.batchModify`).
5. **Search bar** — query `gmail.db.messages.search` (local cache → instant); advanced filter UI (from/to/subject/label/date) mapping to the search `data` filter object.

**Deliverable:** usable inbox: read, search, compose, send, archive, label.

## Phase 3 — Calendar UI (core requirement)

Routes under `(app)/calendar`:

1. **Week/month grid** — reads `googlecalendar.db.events.search` (plus `db.calendars.search` for calendar list). Refresh action → `api.events.getMany`.
2. **Create/edit event** — form with title, time, attendees, description → `api.events.create` / `api.events.update` (attendees = calendar invites). Delete → `api.events.delete`.
3. **Availability helper** — when picking a time, call `api.calendar.getAvailability` to render free/busy.
4. Quick-add from mail: "Create event from this email" button in thread view pre-fills the event form.

**Deliverable:** view schedule, create/update events, send invites with attendees.

## Phase 4 — LLM provider layer (BYOK + cloud)

1. Install `ai` plus provider packages: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` (and others as desired).
2. Prisma: `UserAiSettings` (userId, provider, model, encryptedApiKey, tier: `byok` | `cloud`). Encrypt keys at rest (AES-GCM with an `APP_SECRET`); never send keys back to the client.
3. `lib/ai/registry.ts`: maps `(provider, model, apiKey?)` → AI SDK model instance. Cloud tier → `openai(...)` with `OPENAI_API_KEY`; BYOK → provider with the user's decrypted key.
4. Settings page `/settings/ai`: provider dropdown → model list per provider (static curated list per provider, kept in one config file), API key input with a "test key" action (1-token generateText call).

**Deliverable:** `getModelForUser(userId)` used by chat and the classifier.

## Phase 5 — Agent chat via Corsair MCP (top bonus)

1. `app/api/chat/route.ts` (route handler, streaming):
   ```ts
   const mcpClient = await corsair.instance(INSTANCE_ID).tenant(user.corsairTenantId).mcp.createVercelClient();
   const result = streamText({
     model: await getModelForUser(user.id),
     tools: await mcpClient.tools(),          // must await
     stopWhen: stepCountIs(15),
     messages,
     system: "...persona + today's date + user's email/timezone...",  // do NOT list Corsair op names
   });
   ```
2. Chat UI at `(app)/chat` (and/or a slide-over panel available everywhere) using `useChat` from the AI SDK; render tool-call progress ("Sending email…", "Creating event…").
3. System prompt includes current date/time + timezone so "9 AM next Thursday" resolves correctly.
4. Confirmation UX for destructive/outbound actions (optional hardening): set plugin permission mode and rely on Corsair's `cautious` mode, or add an app-level confirm step before send.
5. Persist chat history (Prisma `ChatMessage`) — nice-to-have.

**Deliverable:** the example use case works: "Send a calendar invite to friend@corsair.dev at 9 AM next Thursday. Send him an email too…"

## Phase 6 — Realtime webhooks (bonus) — ⏸️ DEFERRED (2026-06-12, day 3)

> **Status: deliberately deferred by user decision.** Still blocked on the unknown Corsair webhook registration + signature-verification mechanism (not in `corsair-reference.md`). The design below is unchanged and remains the intended approach. See handoff.md "Phase 6 — deferred (read before picking it up)" for the exact unknowns and the resolution path (fetch live Corsair docs / ask support, then append to corsair-reference.md). Nothing was stubbed — clean start. Phase 7's classifier currently runs on render/refresh; once webhooks land they should also trigger `classifyMessages` for new mail.


1. `app/api/webhooks/corsair/route.ts` receives `gmail.webhooks.messageChanged` and `googlecalendar.webhooks.onEventChanged`. Check the Corsair dashboard/docs for the exact registration mechanism and signature verification (this detail isn't in our cached reference — fetch `https://docs.corsair.dev/app/direct-execution.md` neighbors or the dashboard when implementing).
2. Local dev: ngrok tunnel (`ngrok http 3000`) → register the tunnel URL as webhook target.
3. On event: upsert a row in an `InboxEvent` table keyed by tenant, then notify the client.
4. Client push: simplest robust option is an **SSE endpoint** (`/api/stream`) per user that the inbox/calendar subscribes to; on message, re-fetch the `db.*` feed. (Avoid polling Google APIs entirely — Corsair keeps its cache synced.)
5. Webhook also triggers the priority classifier (Phase 7) for new messages.

**Deliverable:** new email appears in the inbox within seconds, no manual refresh.

## Phase 7 — AI priority filtering (bonus) — ✅ DONE (2026-06-12, day 3)

> **Implemented via backfill-on-render** (the webhook trigger from Phase 6 is deferred). `EmailMeta` model + `lib/ai/classify.ts` (`classifyMessages` / `getPriorities`, `cheapModel` + `generateObject`, best-effort no-throw), badge + "Urgent first" toggle in `/mail`. Needs `OPENAI_API_KEY` or a BYOK key to classify. Details in handoff.md day-3 update.


1. Prisma: `EmailMeta` (gmailMessageId, userId, priority: `urgent|normal|low`, reason, createdAt).
2. Classifier in `lib/ai/classify.ts`: cheap model (cloud: `gpt-4.1-mini`/nano; BYOK: cheapest model of their provider) with `generateObject` → `{ priority, reason }` from subject + first ~1k chars of body.
3. Trigger: on webhook for new messages (Phase 6) and as backfill on refresh for unclassified messages.
4. UI: priority badge + inbox sections/filter ("Urgent first").

**Deliverable:** inbox triaged automatically as mail arrives.

## Phase 8 — Keyboard shortcuts (bonus)

1. Small `useHotkeys` hook (or `react-hotkeys-hook`) mounted in the `(app)` layout; disabled while focus is in inputs/editors.
2. Bindings (Superhuman/Gmail-style): `c` compose, `r` reply, `e` archive, `#` trash, `j/k` next/prev thread, `Enter` open, `u` back to list, `/` focus search, `g i` inbox, `g c` calendar, `⌘K` command palette (optional: command palette also routes to agent chat).
3. `?` opens a shortcuts cheat-sheet modal.

**Deliverable:** full mail triage without touching the mouse.

## Phase 9 — Polish & demo readiness

- Loading/empty/error states everywhere; re-auth redirect path tested (revoke + reconnect).
- Rate-limit chat endpoint; cap `stopWhen` steps.
- Seed/demo script and a rehearsed demo flow: sign in → connect → inbox triage (keyboard) → webhook live email → chat sends invite + email.
- `README` update: env vars (`DATABASE_URL`, `CORSAIR_DEV_KEY`, `CORSAIR_INSTANCE_ID`, `OPENAI_API_KEY`, `APP_SECRET`, auth secrets), setup steps, provisioning script.

---

## Suggested order & dependencies

```
Phase 0 → 1 → 2 → 3   (core, sequential)
Phase 4 → 5            (agent chat; 4 can start in parallel with 2/3)
Phase 6 → 7            (webhooks before classification triggers)
Phase 8                (anytime after 2)
Phase 9                (last)
```

## Open items to resolve during implementation

- Exact webhook registration + signature verification mechanism (Corsair dashboard or SDK) — not covered in cached docs.
- Whether Corsair provides default Google OAuth credentials on hosted plans or we must supply root `client_id`/`client_secret` from our own Google Cloud project (affects Phase 0 step 3).
- Per-operation input schemas: consult `https://api.corsair.dev/md/integrations/<operation-path>` as each feature is built, and append findings to `corsair-reference.md`.
