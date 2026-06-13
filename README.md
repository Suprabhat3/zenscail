<div align="center">

# ZenScail

### Your inbox and calendar, finally on your terms.

An AI-native Gmail + Google Calendar workspace built on [**Corsair**](https://corsair.dev) — triage mail, run your schedule, and drive both with a natural-language agent that can actually *do* things on your behalf.

**🔗 Live app → [https://zenscail.com](https://zenscail.com)**

[Features](#-what-makes-zenscail-different) · [Demo flow](#-the-flagship-demo) · [Architecture](#-architecture) · [Corsair usage](#-how-we-use-corsair) · [Run it locally](#-running-locally) · [Deployment](#-deployment)

</div>

---

## ✨ Why ZenScail

Gmail and Google Calendar are powerful, but their UIs decide *for you* what matters and how many clicks a task takes. ZenScail flips that: it uses Corsair's Gmail and Calendar building blocks to assemble a workflow that is **faster, quieter, and keyboard-first**, with AI woven in only where it removes real friction — never "AI for the sake of AI."

The result is a single surface where you can clear an inbox without touching the mouse, see only what's urgent, turn an email into a meeting in one step, and tell an assistant *"invite Sam at 9 AM Thursday and email him I'm looking forward to it"* — and watch it happen.

---

## 🚀 What makes ZenScail different

| | Feature | What it does |
|---|---|---|
| 🤖 | **Agent chat (Corsair MCP)** | A streaming assistant wired to your Gmail + Calendar through the **Corsair MCP server**. It composes and sends mail, creates events with attendees, and resolves relative dates ("next Thursday at 9") against the real clock. Resilient transport with automatic HTTP→SSE fallback and mid-stream reconnect. |
| 🔥 | **AI priority inbox** | Every email is classified `urgent` / `normal` / `low` with a one-line reason by a cheap LLM. An **"Urgent first"** toggle reorders the inbox so the things that can't wait float to the top. |
| ☀️ | **Daily AI brief** | A once-a-day generated digest of your inbox + calendar: a headline, action items deep-linked to the source email, and today's meetings. Runs automatically via a scheduled cron, and the chat agent can expand on or act on any item. |
| ⌨️ | **Keyboard-first triage** | Superhuman-style shortcuts — `c` compose, `r` reply, `e` archive, `#` trash, `j/k` navigate, `/` search, `g i\|c\|t` to jump around, `?` for the cheat-sheet. Clear your inbox without leaving the home row. |
| 📅 | **Email → Calendar in one step** | "Create event from this email" pre-fills a new event from the thread you're reading. |
| 🗓️ | **Full calendar control** | Week grid, create / edit / delete events, attendee invites (real invite emails via `sendUpdates: "all"`), free/busy availability, and optional Google Meet links. |
| 📡 | **Realtime updates** | Corsair webhooks push new mail and calendar changes over a per-user SSE stream — the open inbox/calendar refreshes within seconds, no polling Google. New mail also triggers priority classification on arrival. |
| 🔑 | **BYOK + cloud LLM** | Bring your own key for **OpenAI, Anthropic, Google, or Groq** and pick any model (free tier), or use the built-in cloud tier. Keys are encrypted at rest with AES-256-GCM. |

---

## 🎬 The flagship demo

> **"Send a calendar invite to dev@corsair.dev at 9 AM next Thursday. Send him an email too saying I look forward to our meeting."**

Open `/chat`, type that, and ZenScail will — through the Corsair MCP — create the calendar event (sending the invite) **and** send the follow-up email, narrating each step as it goes. This is the highest-value bonus task from the brief, and it works end to end.

---

## 🏗️ Architecture

```
                            Browser (App Router UI)
              /mail · /calendar · /chat · /dashboard · /settings
                 │  server actions · route handlers · SSE
                 ▼
        ┌───────────────────────── Next.js 16 backend ─────────────────────────┐
        │                                                                       │
        │  Better Auth (email/pw + Google)  ──►  User ⇄ Corsair tenant (1:1)    │
        │                                                                       │
        │  lib/corsair.ts ──► @corsair-dev/app                                  │
        │     tenant(user).run("gmail.api.*" / "googlecalendar.api.*")          │
        │                                                                       │
        │  /api/chat      ──► streamText(model) + Corsair MCP tools (agent)     │
        │  /api/webhooks  ──► verify token → log → classify → SSE publish       │
        │  /api/stream    ──► per-user Server-Sent Events                       │
        │  /api/cron      ──► daily brief generation (Vercel Cron)              │
        │                                                                       │
        │  Prisma 7 + Neon Postgres: users, AI settings (encrypted BYOK keys),  │
        │     email priority metadata, daily briefs, webhook event log          │
        └───────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
        Corsair (hosted) — instance "zenscail", plugins: gmail + googlecalendar,
        one tenant per user, OAuth via our Google Cloud root credentials.
```

**Design principle:** each app user maps **1:1 to a Corsair tenant** (the tenant id *is* our user id), so every Gmail/Calendar call is automatically scoped to the right account.

---

## 🔌 How we use Corsair

Corsair is the **mandatory, sole** integration layer for Gmail and Google Calendar — there is no direct Google API usage and no hardcoded data anywhere in the app.

- **Client & tenancy** — [`lib/corsair.ts`](lib/corsair.ts) holds a lazy singleton client and a `corsairTenant(id)` helper; [`lib/tenant.ts`](lib/tenant.ts) provisions one Corsair tenant per user on first sign-in.
- **Gmail** — [`lib/gmail.ts`](lib/gmail.ts): list/search, hydrate threads, compose & send (RFC-2822 `raw`), reply, archive/trash, label modify.
- **Calendar** — [`lib/gcal.ts`](lib/gcal.ts): list events over a time range, create/update/delete with attendee invites, and free/busy availability.
- **Agent (MCP)** — [`app/api/chat/route.ts`](app/api/chat/route.ts) connects to Corsair's hosted **MCP server** and exposes its tools to the Vercel AI SDK so the LLM can take real actions.
- **Webhooks** — [`app/api/webhooks/corsair/route.ts`](app/api/webhooks/corsair/route.ts) receives Corsair's realtime events on one token-authenticated endpoint and fans them out over SSE.
- **Provisioning** — [`scripts/provision-corsair.mts`](scripts/provision-corsair.mts) idempotently creates the `zenscail` instance, installs both plugins (`mode: cautious`, `authType: oauth_2`), and registers root OAuth credentials.

> Implementation notes and hard-won Corsair API details live in [`docs/`](docs/) (`corsair-reference.md`, `implementation-plan.md`, `handoff.md`).

---

## 🧰 Tech stack

- **Next.js 16.2.9** — App Router, Turbopack, React 19. *(Note: middleware is `proxy.ts`; `params`/`searchParams` are Promises.)*
- **Prisma 7 + Neon Postgres** — managed with `prisma db push`.
- **Better Auth** — email/password + optional Google social login.
- **Corsair** (`@corsair-dev/app`) — Gmail + Google Calendar integration & MCP.
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai|anthropic|google|groq`, MCP) — classification, daily brief, and agent chat.
- **Tailwind CSS v4.**
- **Deployed on Vercel** (with Cron for the daily brief).

---

## 🖥️ Running locally

### Prerequisites
- Node 20+ and **pnpm** (this project uses pnpm exclusively — never npm).
- A Neon (or any) Postgres database.
- A Corsair developer key — https://app.corsair.dev/api-keys.
- A Google Cloud OAuth web client (used as Corsair's root credentials).
- Optionally an OpenAI key for the cloud LLM tier.

### Environment variables

Create a `.env` in the project root:

```bash
# Database
DATABASE_URL=postgresql://...               # Neon connection string

# Corsair
CORSAIR_DEV_KEY=ch_...                       # developer key from app.corsair.dev/api-keys
CORSAIR_INSTANCE_ID=...                      # printed by the provisioning script

# Auth
BETTER_AUTH_SECRET=...                       # random 32+ char secret
BETTER_AUTH_URL=http://localhost:3000        # your public origin in production

# Google OAuth (Corsair root creds for Gmail/Calendar; also enables Google app login)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# LLM
OPENAI_API_KEY=sk-...                        # cloud tier (optional if every user brings a key)
APP_SECRET=...                               # 32+ char secret; encrypts BYOK keys (AES-256-GCM)

# Email (Resend) — verification OTP + onboarding emails
RESEND_API_KEY=re_...                        # optional in dev: unset → emails are logged to console
EMAIL_FROM="ZenScail <onboarding@resend.dev>" # must be a Resend-verified sender/domain

# Realtime + cron (optional in dev)
PUBLIC_WEBHOOK_ORIGIN=https://...            # public origin Corsair posts webhooks to (e.g. ngrok / prod)
CRON_SECRET=...                              # secures /api/cron/daily-summary
```

### Google Cloud console setup
1. Enable the **Gmail API** and **Google Calendar API**.
2. Add authorized redirect URIs:
   - `https://api.corsair.dev/oauth/callback` (Corsair data access)
   - `<your-origin>/api/auth/callback/google` (only if using Google app login)
3. On the OAuth consent screen (testing mode), add your Google account(s) as **Test users**.

### Setup

```bash
pnpm install                 # installs deps + runs prisma generate
pnpm exec prisma db push     # push the schema (do NOT use migrate — it resets the DB)
pnpm provision:corsair       # create/verify the Corsair instance + plugins + root creds
pnpm dev                     # http://localhost:3000
```

`pnpm provision:corsair` is idempotent — it upserts the `zenscail` instance, installs the gmail + googlecalendar plugins, and registers your `GOOGLE_CLIENT_ID/SECRET` as plugin root credentials. Copy the printed instance id into `CORSAIR_INSTANCE_ID`.

### Usage flow
1. Sign up / sign in at `/login`.
2. You're routed to `/connect` — follow the Google OAuth link to connect Gmail + Calendar to your Corsair tenant.
3. `/mail` populates with your inbox; `/calendar` shows your week; `/dashboard` shows your daily brief.
4. Configure your LLM under `/settings/ai` (provider + model + optional key) to enable chat, priority filtering, and the brief.
5. Open `/chat` and drive everything by natural language.

---

## ☁️ Deployment

ZenScail is deployed on **Vercel** at **[https://zenscail.com](https://zenscail.com)**.

- All environment variables above are configured in the Vercel project.
- [`vercel.json`](vercel.json) registers the **daily-brief cron** (`/api/cron/daily-summary`) and tunes function durations for the streaming chat and webhook routes.
- Set `BETTER_AUTH_URL` and `PUBLIC_WEBHOOK_ORIGIN` to your production origin, then register the webhook URL (`pnpm webhook:url`) in the Corsair dashboard to enable realtime push.

### Realtime webhooks
Corsair delivers events to one token-authenticated endpoint. For local testing, expose your dev server with `ngrok http 3000`, set `PUBLIC_WEBHOOK_ORIGIN` to the tunnel URL, run `pnpm webhook:url` to print the per-tenant URL, and register it in the Corsair dashboard. In production the same applies with your deployed origin.

---

## 📁 Project structure

```
app/
  (app)/            authenticated shell — mail, calendar, chat, dashboard, settings, connect
  (auth)/login      sign in / sign up
  api/
    auth/[...all]   Better Auth handler
    chat            streaming agent chat (Corsair MCP tools)
    webhooks/corsair  inbound Corsair webhook receiver
    stream          per-user Server-Sent Events
    cron/daily-summary  scheduled daily brief
lib/
  corsair.ts · tenant.ts    Corsair client + per-user tenant mapping
  gmail.ts · gcal.ts        typed Gmail / Calendar operation helpers
  ai/                       provider registry, model lists, classifier, daily brief, MCP transport
  realtime.ts · webhooks.ts SSE bus + webhook token verification
  auth.ts · session.ts · crypto.ts
scripts/            Corsair provisioning, status checks, webhook URL helper (ESM .mts)
docs/               implementation plan, handoff notes, verified Corsair API reference
prisma/schema.prisma
```

---

## 📝 Notes & limitations

- Corsair's `db.*` caches store only minimal refs (no message/event content), so mail and calendar read content live via `*.api.*`. Correct, but it means several parallel `messages.get` calls per inbox render — fine for the current scale, a caching candidate for heavy production use.
- Schema changes use `prisma db push`, never `migrate` (migrate wants to reset the DB).
- Plugins run in Corsair `cautious` mode; outbound/destructive agent actions can be tightened or loosened via per-op permission overrides.

---

<div align="center">

Built with Corsair · **Builder Mode On | MacBook Giveaway Hackathon**

`#chaicode` `#corsair-dev`

</div>
