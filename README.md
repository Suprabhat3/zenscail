# ZenScail

AI-powered Gmail + Google Calendar manager built on [Corsair](https://corsair.dev). Sign in, connect your Google account, and triage mail, manage your calendar, and drive both from a natural-language agent chat — with automatic AI priority filtering and keyboard-first navigation.

## Features

- **Mail** — inbox, search, thread view, compose/reply, archive & trash, all backed by Gmail via Corsair.
- **Calendar** — week grid, create/edit/delete events with attendee invites, free/busy availability, and "create event from email".
- **AI priority filtering** — each incoming email is classified `urgent` / `normal` / `low` with a one-line reason; an "Urgent first" toggle reorders the inbox.
- **Agent chat** — a streaming assistant with access to your Gmail + Calendar through the Corsair MCP server (e.g. _"Send a calendar invite to friend@corsair.dev at 9 AM next Thursday and email them I look forward to it"_).
- **BYOK + cloud LLM** — bring your own API key for any major provider (OpenAI / Anthropic / Google) or use the built-in cloud tier. Keys are encrypted at rest.
- **Keyboard shortcuts** — `c` compose, `r` reply, `e` archive, `#` trash, `j/k` navigate, `/` search, `g i|c|t` nav, `?` cheat-sheet.

## Tech stack

- **Next.js 16.2.9** (App Router, Turbopack, React 19) — note: middleware is `proxy.ts`; `params`/`searchParams` are Promises.
- **Prisma 7 + Neon Postgres** (managed with `prisma db push`, **not** `migrate`).
- **Better Auth** — email/password (+ optional Google social login).
- **Corsair** (`@corsair-dev/app`) — Gmail + Google Calendar integration layer, one tenant per user.
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai|anthropic|google`, MCP) for classification + agent chat.
- **Tailwind CSS v4.**

## Prerequisites

- Node 20+ and **pnpm** (this project uses pnpm exclusively — never npm).
- A Neon (or any) Postgres database.
- A Corsair developer key (https://app.corsair.dev/api-keys).
- A Google Cloud OAuth web client (used as Corsair's root credentials for Gmail/Calendar access).
- Optionally an OpenAI API key for the cloud LLM tier.

## Environment variables

Create a `.env` in the project root:

```bash
# Database
DATABASE_URL=postgresql://...               # Neon connection string

# Corsair
CORSAIR_DEV_KEY=ch_...                       # developer key from app.corsair.dev/api-keys
CORSAIR_INSTANCE_ID=...                      # printed by the provisioning script

# Auth
BETTER_AUTH_SECRET=...                       # random 32+ char secret
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth (used as Corsair root creds for Gmail/Calendar;
# also enables Google app login if you want it)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# LLM
OPENAI_API_KEY=sk-...                        # cloud tier; optional if every user brings their own key
APP_SECRET=...                               # 32+ char secret; encrypts users' BYOK keys at rest (AES-256-GCM)
```

### Google Cloud console setup

In the GCP project backing `GOOGLE_CLIENT_ID/SECRET`:

1. Enable the **Gmail API** and **Google Calendar API**.
2. Add authorized redirect URIs:
   - `https://api.corsair.dev/oauth/callback` (Corsair data access)
   - `http://localhost:3000/api/auth/callback/google` (only if using Google app login)
3. On the OAuth consent screen (testing mode), add your Google account(s) as **Test users**, or the connect flow returns `403 access_denied`.

## Setup

```bash
pnpm install                 # installs deps + runs prisma generate
pnpm exec prisma db push     # push the schema to your database (do NOT use migrate — it resets the DB)
pnpm provision:corsair       # create/verify the Corsair instance + gmail/googlecalendar plugins + root creds
pnpm dev                     # http://localhost:3000
```

`pnpm provision:corsair` is idempotent — it upserts the `zenscail` Corsair instance, installs the gmail + googlecalendar plugins (`mode: cautious`, `authType: oauth_2`), and registers your `GOOGLE_CLIENT_ID/SECRET` as plugin root credentials. Copy the printed instance id into `CORSAIR_INSTANCE_ID`.

## Usage flow

1. Sign up / sign in at `/login`.
2. You're routed to `/connect` — follow the Google OAuth link to connect Gmail + Calendar to your Corsair tenant.
3. `/mail` populates with your inbox (priority badges appear once an LLM key is configured); `/calendar` shows your week.
4. Configure your LLM under `/settings/ai` (provider + model + optional API key) to enable chat and priority filtering.
5. Open `/chat` to drive everything by natural language.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | `prisma generate` + production build |
| `pnpm provision:corsair` | Provision/verify the Corsair instance & plugins |
| `pnpm exec prisma db push` | Sync the Prisma schema to the database |

## Project structure

- `app/(app)/` — authenticated shell: `mail`, `calendar`, `chat`, `settings`, `connect`.
- `app/api/auth/[...all]` — Better Auth handler · `app/api/chat` — streaming agent chat.
- `lib/corsair.ts` · `lib/tenant.ts` — Corsair client + per-user tenant mapping.
- `lib/gmail.ts` · `lib/gcal.ts` — typed Gmail / Calendar operation helpers.
- `lib/ai/` — provider registry, model lists, and the priority classifier.
- `scripts/provision-corsair.mts` — one-time Corsair provisioning (ESM, `.mts`).
- `docs/` — implementation plan, handoff notes, and verified Corsair API reference (read these before extending).

## Notes & limitations

- **Realtime webhooks (live inbox push) are not implemented** — the inbox and priority classifier run on page load / Refresh. See `docs/handoff.md` ("Phase 6 — deferred") for the design and the open questions.
- Corsair's `db.*` caches store only minimal refs (no message/event content), so mail and calendar read content live via `*.api.*`. This is correct but means ~25 parallel `messages.get` calls per inbox render — fine for a demo, a caching candidate for production.
- Schema changes use `prisma db push`, never `migrate` (migrate wants to reset the DB and would wipe data).
