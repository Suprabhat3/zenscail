# Handoff — ZenScail (written 2026-06-12, end of day 1; updated day 2; day 3; day 4; day 5)

> **Day-5 update: Auth hardening — email OTP verification, onboarding emails, and connected-mailbox identity.** Build + typecheck pass.
> - **Email infra (Resend):** `pnpm add resend`. `lib/email/render.ts` = brand-styled inline-CSS HTML templates (`verificationEmail`, `onboardingEmail`) matching the cream/rose palette; `lib/email/send.ts` = lazy Resend client with a **dev fallback** (logs to console when `RESEND_API_KEY` unset, so signup works keyless). New env: `RESEND_API_KEY`, `EMAIL_FROM` (added to `.env` + README).
> - **OTP verification (blocking):** Better Auth `emailOTP` plugin (`otpLength:6`, `expiresIn:5m`, `sendVerificationOnSignUp`, `overrideDefaultEmailVerification`) + `emailAndPassword.requireEmailVerification:true` + `emailVerification.autoSignInAfterVerification:true` in `lib/auth.ts`. Client plugin `emailOTPClient()` added to `lib/auth-client.ts` — **note the client namespace is `authClient.emailOtp` (camelCase) with `sendVerificationOtp`/`verifyEmail`.** `LoginForm` gained a `verify` step (6-digit input + resend); unverified sign-ins are routed there too.
> - **Onboarding email (once per user):** guarded by new `User.welcomedAt`. Password users → `emailVerification.afterEmailVerification`; Google users (already `emailVerified` at create) → `databaseHooks.user.create.after`. `sendWelcomeOnce()` sets `welcomedAt` before sending so it never duplicates.
> - **Connected-mailbox identity (login-email vs Gmail mismatch fix):** new `User.connectedEmail`. Corsair exposes NO `gmail.api.users.getProfile`, so `lib/gmail.ts` `getConnectedAddress()` samples ~8 inbox messages and takes the most common `Delivered-To` (fallback `To`). `lib/identity.ts`: `syncConnectedEmail()` (persists, best-effort) + `resolveIdentity()` (computes `primaryEmail`/`mismatch`). `/connect` syncs on render + shows the mailbox & a mismatch warning. App layout shows the **connected mailbox as primary identity** (UserMenu) + a top mismatch banner with "Switch account" → `/connect`. The webhook receiver also opportunistically records `emailAddress` from gmail payloads. `prisma db push`ed both new fields.
> - **Remaining manual step the user owns:** set `RESEND_API_KEY` + a verified `EMAIL_FROM` in `.env` to actually send (until then codes/onboarding print to the server console). Live-verify the full signup → OTP → onboarding flow once the key is set.


> **Day-4 update: Phase 6 (realtime webhooks + SSE) is DONE.** The blocker (unknown registration/signature mechanism) is resolved — details in corsair-reference.md "Webhook delivery (RESOLVED)". Summary:
> - **Registration:** Corsair uses ONE dashboard-registered delivery URL with a (hashed) tenant id as a query param. There is NO SDK RPC to register it (SDK 0.1.5, latest). The newer `processWebhook` signature-verification helper is also not in 0.1.5.
> - **Receiver:** `app/api/webhooks/corsair/route.ts` — auth'd by a per-tenant HMAC token in the URL (`lib/webhooks.ts`, keyed by `APP_SECRET`; constant-time check). Maps `tenantId`→user, logs an `InboxEvent` row, triggers `classifyMessages` inline for new mail (Phase 7's realtime trigger), publishes a realtime event.
> - **SSE:** in-memory bus `lib/realtime.ts` (single-process — fine for dev/single-instance; swap for Redis/LISTEN-NOTIFY if multi-instance) → per-user stream `app/api/stream/route.ts` → client `components/realtime/LiveUpdates.tsx` (mounted in `(app)/layout.tsx`) debounced `router.refresh()` + toast.
> - **Schema:** `InboxEvent` model added + `prisma db push`ed to Neon.
> - **Tooling:** `pnpm webhook:url` (scripts/webhook-url.mts) prints the per-tenant URL to register. New optional env `PUBLIC_WEBHOOK_ORIGIN` (ngrok tunnel; falls back to BETTER_AUTH_URL).
> - **Verified:** dev server smoke test — 401 on bad/missing token, 200 + classify + event-log + publish on valid token (hit real Corsair for the connected tenant `demo@gmail.com`).
> - **Manual step the user owns:** `ngrok http 3000` → set `PUBLIC_WEBHOOK_ORIGIN` → `pnpm webhook:url` → paste the URL into the Corsair dashboard's webhook settings. Then send yourself an email and watch the inbox refresh.
> - **Note:** the receiver does its list+classify work inline (~12s observed) before returning 200. Fine for the demo; if Corsair retries on slow responses, move classify off the response path (queue/after()).

> **Day-3 update: Phase 7 (AI priority filtering) is code-complete via the backfill-on-refresh path. Phase 6 (webhooks) was deliberately DEFERRED by user decision — see "Phase 6 — deferred (read before picking it up)" below for the full context the next agent needs.**
>
> - **Phase 7 (priority filtering):** `EmailMeta` model added to `prisma/schema.prisma` (`userId` + `gmailMessageId` unique, `priority` urgent|normal|low, `reason`) and pushed to Neon via `prisma db push`. `lib/ai/classify.ts`: `classifyMessages(userId, messages, {limit=15})` uses `registry.ts`'s `cheapModel` + `generateObject` (zod schema) to classify unclassified messages and persist them — fully best-effort (returns 0 and never throws when no model is configured or an LLM call fails). `getPriorities(userId, ids)` reads them back. Trigger is backfill-on-render: `app/(app)/mail/page.tsx` calls `classifyMessages` then `getPriorities` on each inbox render (bounded to 15 new classifications/render so it self-completes over a few page loads). UI: `components/mail/PriorityBadge.tsx` (urgent=red / normal / low) rendered per row; **"Urgent first"** toggle in the inbox header (`/mail?view=urgent`) sorts by priority. `zod@4` was added as a direct dep (the AI SDK needs it for `generateObject` schemas). **Classifier needs a model:** works once `OPENAI_API_KEY` is set (cloud cheap = `gpt-5-mini`) OR a BYOK key is configured; until then it silently classifies nothing and the inbox just shows no badges.
> - **Live verification:** dev server was started (`pnpm dev`, http://localhost:3000) and the user was walked through sign up → /connect → Google OAuth → /mail. (Record the outcome here once confirmed — was the inbox populated with real Gmail data? If yes, Phase 2 is finally verified end-to-end and the `CachedMessage` shape in `lib/gmail.ts` can be tightened against real rows.)
>
> ## Phase 9 polish (day 3, later) — loading/error states, calendar content fix, README
>
> - **Sender/subject undefined fix verified path:** the inbox hydration passed `metadataHeaders` to `gmail.api.messages.get`, which makes Corsair return `payload.headers: undefined`. Removed it (see corsair-reference.md gotcha) → From/Subject populate.
> - **Calendar had the SAME cache-content bug as the inbox.** `lib/gcal.ts` `searchCachedEvents` read `summary`/`start`/`end` from `googlecalendar.db.events.search`, but that cache stores only minimal refs (no content) — so events showed "(no title)" and were filtered out (undefined start/end → millis 0 → outside every day range). **Fixed:** new `listEvents(t, {rangeStart, rangeEnd, limit})` reads live from `googlecalendar.api.events.getMany` (`singleEvents`, `orderBy:startTime`, server-side `timeMin/timeMax`), returns `{ok, messages}`. `searchCachedEvents` is now a thin wrapper kept for compat. `app/(app)/calendar/page.tsx` uses `listEvents` and redirects `/connect` on `ok:false` (dropped the old empty-cache-then-refresh dance). `event/[id]/page.tsx` already used `api.events.get` directly — fine. `refreshEvents` still backs the Refresh button.
> - **Loading states:** `app/(app)/mail/loading.tsx` + `app/(app)/calendar/loading.tsx` skeletons (these routes do live API reads, so the suspense fallback is real UX).
> - **Error boundary:** `app/(app)/error.tsx` (client component) — covers the whole authed shell with Try again (`reset()`) + Reconnect-account (`/connect`) actions.
> - **README** fully rewritten (was the default create-next-app boilerplate): features, stack, env vars, GCP console steps, `pnpm` setup + provisioning, usage flow, structure, limitations (webhooks deferred, live-read perf note, db-push-not-migrate).
> - **Still ⬜ in Phase 9:** live re-auth (revoke+reconnect) test, and a seed/demo script + rehearsed demo flow. Phase 6 (webhooks) remains deferred.
>
> ## Inbox hydration fix (day 3) — cache has no content, must hydrate
>
> After connecting, the inbox rendered every row as "(unknown sender)/(no subject)" and thread links were `/mail/thread/undefined`. Root cause: `gmail.db.messages.search` cache rows only contain `{ entity_id (=gmail msg id), data: { id, threadId, createdAt } }` — NO subject/from/snippet/body (corrected in corsair-reference.md; the old "flattened columns" note was wrong). Fixed in `lib/gmail.ts`: removed `CachedMessage`/`searchCachedMessages`, added `InboxMessage` + `listInboxMessages` which lists refs via `gmail.api.messages.list` (`labelIds:["INBOX"]` default, or Gmail `q` for search) then **hydrates** each via `gmail.api.messages.get` (format=metadata → From/Subject/snippet/date/labels). `app/(app)/mail/page.tsx` now uses `listInboxMessages` ({ok, messages}); `classify.ts` takes `InboxMessage` (uses `snippet`, no body). **Perf note:** the inbox now fires ~25 parallel `messages.get` calls per render (+ up to 15 classifier LLM calls on first load) — acceptable for demo but a candidate for caching hydrated metadata into our own Postgres later. Thread view was already correct once a real threadId is passed.
>
> ## OAuth fix (day 3) — Corsair Gmail/Calendar now uses OUR Google app
>
> The `/connect` flow was erroring with **"OAuth client_id is not set for gmail."** Root cause: Corsair-managed OAuth is NOT available for our dev account (`managed_oauth_not_configured`), and the old provisioning passed `useManaged: true` which silently no-ops. **Fixed by bringing our own Google Cloud OAuth web client** (the existing `GOOGLE_CLIENT_ID/SECRET` in `.env`) and registering it as the plugin **root credentials** via `setRoot` in `scripts/provision-corsair.mts` (re-run it; root creds verified SET on both plugins). Full detail in corsair-reference.md "OAuth (RESOLVED...)". **Manual step the user owns in Google Cloud console:** enable Gmail API + Calendar API, add redirect URI `https://api.corsair.dev/oauth/callback`, add test users on the (unverified) consent screen. Until that propagates, the connect link will still fail. Email/password app login is KEPT (the user chose the root-creds path, not Google-only login). Re-verify `/connect` → Google consent → `/mail` once GCP is configured.
>
> ## Phase 6 — deferred (read before picking it up)
>
> Webhooks + SSE were intentionally left unbuilt. The blocker is unchanged: **the exact Corsair webhook registration + signature-verification mechanism is not in our cached `corsair-reference.md`.** What we know / what the next agent must do:
> - Ops exist: `gmail.webhooks.messageChanged` and `googlecalendar.webhooks.onEventChanged` (listed in corsair-reference.md). The tenant credential field `webhook_signature` exists and is almost certainly part of verification.
> - **Unknown:** how a webhook target URL is registered (SDK call vs. Corsair dashboard), the payload shape, and how to verify the signature. Resolve by fetching live Corsair docs (`https://docs.corsair.dev/app/...`, neighbors of direct-execution) or asking Corsair support — then APPEND findings to `corsair-reference.md`.
> - **Planned design (from implementation-plan.md Phase 6, still the intended approach):** `app/api/webhooks/corsair/route.ts` receives events → upsert an `InboxEvent` row keyed by tenant → push to clients via a per-user **SSE** endpoint (`app/api/stream/route.ts`) that `/mail` + `/calendar` subscribe to and re-fetch the `db.*` feed on. Local dev needs an ngrok tunnel (`ngrok http 3000`) registered as the webhook target. The same webhook should also trigger `classifyMessages` for newly-arrived mail (Phase 7's real-time trigger — right now Phase 7 only runs on render/refresh).
> - Nothing for Phase 6 was stubbed — there is no half-built SSE/route handler to clean up. It's a clean start.

> **Day-2 update: Phases 3, 4, 5 and 8 are code-complete; build passes.** Corsair instance re-verified healthy. **The DB has 0 users** — the manual Phase 2 verification (sign up → /connect → Google OAuth → /mail) was never done and still blocks live verification of everything downstream. Run `pnpm exec tsx --env-file=.env scripts/check-tenant-connectivity.mts` to re-check connectivity any time.
>
> - **Phase 3 (Calendar):** `lib/gcal.ts` (typed helpers; `searchCachedEvents` filters date ranges in-app — the events cache has NO start/end filter columns, see corsair-reference.md "Verified calendar operation schemas"), `(app)/calendar` week grid with prev/next/today + refresh, `calendar/new` (form + free/busy via `getAvailability`), `calendar/event/[id]` (edit/delete + attendee RSVPs), shared `components/calendar/EventForm.tsx` + `TimeZoneField.tsx` (browser tz via hidden input), "Create event from this email" quick-add on the thread page. All writes use `sendUpdates: "all"` so attendees get invite emails.
> - **Phase 4 (LLM layer):** `ai` + `@ai-sdk/openai/anthropic/google/react/mcp` installed; `UserAiSettings` model pushed to Neon (`db push`); `lib/crypto.ts` (AES-256-GCM keyed off new `APP_SECRET` in .env); `lib/ai/models.ts` (curated model lists), `lib/ai/registry.ts` (`getModelForUser` → BYOK or cloud, plus a `cheapModel` for the Phase 7 classifier); `/settings/ai` page with save + "test key" (1-token generateText). **`OPENAI_API_KEY` is still NOT set** — cloud tier throws until it is; BYOK works without it.
> - **Phase 5 (Agent chat):** `app/api/chat/route.ts` (`streamText` + Corsair MCP `createVercelClient().tools()`, `stepCountIs(15)`, system prompt has date/time + user email, no op names), `(app)/chat` UI via `useChat` with tool-call progress lines. Untested live (needs a connected account + an LLM key). Remember gotcha 6: `cautious` mode may stall MCP writes pending approval.
> - **Phase 8 (Keyboard shortcuts):** `components/shortcuts/KeyboardShortcuts.tsx` mounted in the `(app)` layout — c/r/e/#/j/k/Enter/u, `/` search, `g i|c|t` nav, `?` cheat-sheet modal; disabled while typing. Mail rows expose `data-thread-link` / `data-row-action` hooks.
>
> - **Navigation/product polish (day 2, later):** landing `Nav` is now session-aware (`useSession`) — Sign in / Get started → `/login` (`?mode=signup` preselects signup), or "Open app" when signed in. `/login` redesigned (split branding panel + labeled form + Google button, honors `?next=`). App shell header rebuilt: `components/app/AppNav.tsx` (active-route highlighting) + `components/app/UserMenu.tsx` (avatar dropdown: Profile / AI settings / Connected accounts / Sign out → lands on `/`). New `/settings` section with tabbed layout (`SettingsTabs`): `/settings/profile` (rename via `authClient.updateUser`, change password via `authClient.changePassword` with `revokeOtherSessions`), `/settings/ai` reworked to fit the layout, `/settings` redirects to profile. `/connect` links back to inbox when all connected. Note: the standalone `SignOutButton` component is no longer used by the layout.
>
> **Remaining:** Phase 6 (webhooks — still blocked on the unknown registration/signature mechanism, needs ngrok), Phase 7 (priority filtering — depends on 6 for triggers, but the backfill-on-refresh path could be built now using `registry.ts`'s `cheapModel`), Phase 9 (polish + README). Nothing committed today; working tree on `dev`.

For the next agent/session. Read this first, then [implementation-plan.md](./implementation-plan.md) (the phased plan) and [corsair-reference.md](./corsair-reference.md) (cached + live-verified Corsair API knowledge — do NOT re-fetch the Corsair web docs; everything needed so far is in that file, and it has corrections the web docs get wrong).

## What ZenScail is

AI-powered Gmail + Google Calendar manager for a hackathon. Tech: Next.js 16.2.9 (App Router, Turbopack), Prisma 7 + Neon Postgres, Tailwind 4, Better Auth, Corsair (`@corsair-dev/app`) as the integration layer. Marketing landing page at `/` predates this work — don't touch it.

**Decisions already made with the user (don't re-ask):**
- Multi-user app with real login; each user maps 1:1 to a Corsair tenant (tenant id = our user id).
- LLM strategy: BYOK multi-provider (user supplies own API key + picks model = free tier) AND a cloud tier using our `OPENAI_API_KEY`. Build provider-agnostic on the Vercel AI SDK.
- Bonus scope: realtime webhooks, AI priority filtering, keyboard shortcuts. Vector search is OUT of scope.
- **Use pnpm for everything. Never npm.**

## Status: Phases 0–2 code-complete; 3–9 not started

| Phase | Status |
|---|---|
| 0 Corsair plumbing | ✅ done, provisioned + live-verified |
| 1 Auth + tenant mapping + /connect | ✅ done, sign-up smoke-tested against Neon |
| 2 Mail UI | ✅ code-complete, build passes, **NOT yet tested with a real connected Gmail** |
| 3 Calendar UI | ✅ code-complete (day 2), untested live |
| 4 LLM provider layer (BYOK + cloud) | ✅ code-complete (day 2); `OPENAI_API_KEY` still unset |
| 5 Agent chat (Corsair MCP + Vercel AI SDK) | ✅ code-complete (day 2), untested live |
| 6 Webhooks + SSE | ⏸️ DEFERRED by user (day 3) — blocked on registration mechanism; see "Phase 6 — deferred" above |
| 7 Priority filtering | ✅ code-complete (day 3); needs an LLM key to actually classify |
| 8 Keyboard shortcuts | ✅ code-complete (day 2) |
| 9 Polish + README | 🟡 in progress (day 3) — loading/error states, calendar content fix, README done; live re-auth test + demo script remain |

**First thing tomorrow:** ask the user whether they completed the manual verification step — `pnpm dev` → sign up at `/login` → `/connect` → connect Google via the Corsair link → check `/mail` populates. This validates Corsair's managed OAuth end-to-end and is the only untested link in the chain. If `/mail` shows data, Phase 2 is fully verified; fix whatever breaks before building Phase 3 on the same patterns. Note: the `db.messages.search` row shape in `lib/gmail.ts` (`CachedMessage`, and `normalizeRows()` which accepts array or `{results}`) is a defensive guess — the real shape was unverifiable without a connected account. Verify and tighten once real data flows.

## Environment

`.env` (real values present, do not commit): `DATABASE_URL` (Neon), `CORSAIR_DEV_KEY` (ch_…), `CORSAIR_INSTANCE_ID=fddeb0a0c5d24d29a39ccfe9b90f2f0d`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, `GOOGLE_CLIENT_ID/SECRET` (EMPTY — optional, only for Google *app login*, unrelated to Corsair's Gmail OAuth which is managed). Still needed later: `OPENAI_API_KEY` (Phase 4), `APP_SECRET` for encrypting BYOK keys (Phase 4).

Corsair instance "zenscail" is active: gmail + googlecalendar plugins installed, `mode=cautious`, `authType=oauth_2`, managed OAuth. Health check: `pnpm exec tsx --env-file=.env scripts/corsair-status.mts`.

## Code map (what was built)

- `lib/corsair.ts` — lazy client singleton (lazy so builds pass without env), `corsairInstance()`, `corsairTenant(tenantId)`, `runOrThrow()` + `CorsairAuthRequiredError` carrying the `signInLink`.
- `lib/tenant.ts` — `ensureCorsairTenant(userId)`: creates tenant lazily, handles 409 `tenant_already_exists`, persists `user.corsairTenantId`.
- `lib/auth.ts` — Better Auth: email/password enabled; Google social auto-enables when env vars set; `databaseHooks.user.create.after` provisions the Corsair tenant best-effort; `nextCookies()` plugin. Handler at `app/api/auth/[...all]/route.ts`; client in `lib/auth-client.ts`; `getSession()/requireSession()` in `lib/session.ts`.
- `proxy.ts` — Next 16 renamed middleware→proxy. Optimistic cookie check guarding `/mail /calendar /chat /connect /settings`.
- `prisma/schema.prisma` — User (with `corsairTenantId`), Session, Account, Verification, Waitlist. **Schema is managed with `prisma db push`, NOT migrate** — `migrate dev` wants to reset the DB and would wipe real waitlist signups. Keep using `db push`.
- `lib/gmail.ts` — typed helpers: `searchCachedMessages` (merges subject/from/body `contains` queries — the filter language has no OR), `refreshMessages`, `getThread`, `sendEmail` (builds base64url RFC 2822 via `buildRawEmail` — Gmail send takes ONLY `raw`), `trashMessage`, `modifyMessage`, MIME body extraction (`extractBodies`), `header()`.
- `app/(app)/` — protected shell layout with nav (Mail/Calendar/Chat/Settings — last three routes don't exist yet); `mail/page.tsx` (inbox + search + refresh + archive/trash), `mail/thread/[id]/page.tsx` (thread + reply), `mail/compose/page.tsx`, `mail/actions.ts` (all server actions; on `success:false` they `redirect("/connect")`), `connect/page.tsx` + `actions.ts` (status probes + connect-link redirect).
- `app/(auth)/login/page.tsx` + `components/auth/LoginForm.tsx`, `SignOutButton.tsx`.
- `scripts/provision-corsair.mts` (`pnpm provision:corsair`, idempotent), `scripts/corsair-status.mts`.

## Gotchas (hard-won — these all bit us)

1. **`@corsair-dev/app` is ESM-only.** Standalone scripts must be `.mts`; plain `.ts` under tsx runs CJS and dies with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Inline `tsx -e` also fails. Imports from Next.js code are fine.
2. **`db.*` reads succeed for unconnected tenants** (empty cache) — never use them to test connectivity. Probe `api.*` ops (`gmail.api.labels.list`, `googlecalendar.api.events.getMany`, both accept no input) and check `result.success`.
3. **`tenant.run()` never throws on missing auth** — returns `{success:false, signInLink}`. Management calls DO throw `CorsairApiError` (e.g. 409 on duplicate tenant create).
4. This Next.js (16.2.9) differs from training data: middleware is `proxy.ts`, `params`/`searchParams` are Promises (await them). Check `node_modules/next/dist/docs/` before using unfamiliar APIs (AGENTS.md mandates this).
5. Read `docs/corsair-reference.md` "Verified operation schemas" before calling any new Corsair op; fetch unknown schemas from `https://api.corsair.dev/md/integrations/<dotted.path>` (e.g. `...integrations/gmail.api.messages.list`) and **append findings to that doc**.
6. Permission modes are `open|cautious|strict|readonly`. `cautious` (current) may require approval for writes invoked via MCP agent chat — if Phase 5 tool calls stall on sends, this is the first thing to check (consider per-op `allow` overrides instead of `open`).

## Tomorrow's plan (in order)

1. Verify Phase 2 with the user's connected account (see above); tighten `CachedMessage` shape.
2. **Phase 3 — Calendar:** mirror the mail patterns. Reads: `googlecalendar.db.events.search` / `db.calendars.search`; writes: `api.events.create/update/delete` (attendees = invites); `api.calendar.getAvailability` for free/busy. Fetch those schemas first (gotcha 5). Routes: `(app)/calendar`, event create/edit form, week grid.
3. **Phase 4 — LLM layer:** `pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google`; `UserAiSettings` Prisma model (provider, model, AES-GCM-encrypted key, tier); `lib/ai/registry.ts` → `getModelForUser(userId)`; `/settings/ai` page.
4. **Phase 5 — Agent chat:** `app/api/chat/route.ts` using `streamText` + `await (await corsairTenant(id).mcp.createVercelClient()).tools()`; system prompt must include current date/time + user email/timezone; do NOT list Corsair op names in the prompt. UI via AI SDK `useChat` at `(app)/chat`.
5. Then phases 6–8 per the implementation plan.

Target demo: keyboard-driven inbox triage → live webhook email arrival → chat: "Send a calendar invite to friend@corsair.dev at 9 AM next Thursday. Send him an email too saying I look forward to our meeting."

## Open questions

- Did managed OAuth work end-to-end? (User was testing at end of day 1.)
- Exact webhook registration + signature verification mechanism for Phase 6 (`gmail.webhooks.messageChanged`, `googlecalendar.webhooks.onEventChanged`) — not in cached docs; check the Corsair dashboard or ask Corsair support. The tenant credential field `webhook_signature` exists and is probably part of the answer. Local dev will need ngrok.
- Nothing is committed yet today — all of this is uncommitted working tree on `main`. Ask the user whether to commit before making further changes.
