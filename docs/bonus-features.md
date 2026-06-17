# ZenScail — Bonus Features Plan (Superhuman-grade)

> Goal: push ZenScail past "Gmail/Calendar with AI" into a genuinely faster, Superhuman-class workflow to maximize hackathon scoring. Every feature here is **net-new** — it does not duplicate what already ships (agent chat, AI priority inbox, daily brief, keyboard shortcuts, email→calendar, realtime webhooks, BYOK, thread summarize/draft).
>
> Read [implementation-plan.md](./implementation-plan.md) and [corsair-reference.md](./corsair-reference.md) before touching Corsair ops. **Use pnpm. Schema changes via `prisma db push`, never `migrate`. Read `node_modules/next/dist/docs/` before unfamiliar Next 16 APIs.**

## Scope (finalized with the user)

Build all eight, prioritized by demo impact. Ship in priority order so we always have a polished, demoable subset.

| # | Feature | Type | Priority |
|---|---|---|---|
| 1 | Command palette (⌘K) | Navigation/UX | 🥇 P0 |
| 2 | Snooze · Send Later · Undo Send | Productivity | 🥇 P0 |
| 3 | Smart bundles / Split inbox | AI triage | 🥈 P1 |
| 4 | Instant AI reply chips | AI | 🥈 P1 |
| 5 | Follow-up reminders | Productivity + AI | 🥈 P1 |
| 6 | Natural-language quick-add bar | AI | 🥉 P2 |
| 7 | Scheduling links (Calendly-style) | Calendar | 🥉 P2 |
| 8 | Smart compose autocomplete | AI | 🧪 P3 (stretch) |

## Conventions to reuse (don't reinvent)

- **Corsair calls:** `corsairTenant(tenantId)` + `runOrThrow`/`t.run`; on `success:false` → `redirect("/connect")` (see [mail/actions.ts](../app/(app)/mail/actions.ts)).
- **Tenant:** `ensureCorsairTenant(session.user.id)`; tenant id == user id.
- **AI:** `getModelForUser(userId)` and `cheapModel` from [lib/ai/registry.ts](../lib/ai/registry.ts); `generateObject` + zod for structured AI (pattern in [lib/ai/classify.ts](../lib/ai/classify.ts)).
- **Chat dock:** `useChatDock().openWith(prompt)` to hand a task to the agent (see [ChatProvider.tsx](../components/chat/ChatProvider.tsx)).
- **Realtime:** `publish(userId, event)` + SSE; client refreshes via [LiveUpdates.tsx](../components/realtime/LiveUpdates.tsx).
- **Keyboard:** extend [KeyboardShortcuts.tsx](../components/shortcuts/KeyboardShortcuts.tsx); skip when focus is in inputs/editors.
- **New scheduled work:** add a Vercel Cron entry in [vercel.json](../vercel.json) guarded by `CRON_SECRET` (pattern in [api/cron/daily-summary/route.ts](../app/api/cron/daily-summary/route.ts)).

---

## Feature 1 — Command palette (⌘K) 🥇 — ✅ SHIPPED

> **Done.** `components/command/CommandProvider.tsx` (shared open-state, mirrors ChatProvider) + `components/command/CommandPalette.tsx` (cmdk, `shouldFilter={false}` with manual static-command filtering so live mail results + "Ask AI" always render). Server action `app/(app)/command/actions.ts` → `searchInbox(query)` (best-effort, cap 6, no redirect). Mounted in `app/(app)/layout.tsx` inside `CommandProvider`. ⌘K/Ctrl+K wired in `KeyboardShortcuts.tsx` (works even while typing) + added to the `?` cheat-sheet. Styles `.cmd-group`/`.cmd-item` in `globals.css`. Groups: Navigate / Actions (context-aware "Reply to this thread") / Mail (debounced 300ms search) / AI (`openWith` hand-off). `pnpm build` clean. **Manual smoke test still owed:** open app → ⌘K → type → search + Ask AI.



A single overlay to navigate, act, search, and invoke AI. The signature Superhuman interaction; it also makes everything else discoverable in the demo.

**Deliverable:** ⌘K (and `/` from KeyboardShortcuts) opens a palette; typing filters commands; Enter runs; results include live mail search and an "Ask AI" escape hatch.

1. **Library:** `pnpm add cmdk` (headless, accessible, fast fuzzy). No backend dep.
2. **Component** `components/command/CommandPalette.tsx` (client), mounted once in [`app/(app)/layout.tsx`](../app/(app)/layout.tsx) inside the existing `ChatProvider`.
3. **State/open:** local `open` state toggled by ⌘K/Ctrl+K and Esc. Wire the existing KeyboardShortcuts `⌘K` binding to a shared event (custom `window` event `zenscail:command-open`, or lift open-state into a small `CommandProvider` mirroring `ChatProvider`).
4. **Command groups:**
   - **Navigate:** Inbox, Calendar, Chat, Dashboard, Settings → `router.push`.
   - **Actions (context-aware):** Compose (`/mail/compose`), Refresh inbox, New event (`/calendar/new`), Toggle "Urgent first". When a thread is open: Archive / Trash / Snooze / Reply — call the existing server actions.
   - **Search mail:** debounced input (300ms) → server action `searchInbox(query)` wrapping `listInboxMessages(t, { query })`; render top 6, Enter opens the thread.
   - **Ask AI:** always-present row "Ask ZenScail: \<your text\>" → `openWith(text)` (hands off to the agent dock).
5. **Server action** `app/(app)/command/actions.ts` → `searchInbox(query)` returns `InboxMessage[]` (cap 6, `"use server"`).
6. **Polish:** recent/most-used commands at top, keyboard hints on the right, subtle group headers. Match the existing accent CSS vars (`--accent`, `--line`, `--ink-soft`).

**Demo line:** "⌘K → 'invite' → Ask AI" flows straight into the flagship agent demo.

---

## Feature 2 — Snooze · Send Later · Undo Send 🥇 — ✅ SHIPPED

> **Done.** Schema: `SnoozedThread` (`@@unique([userId, threadId])`) + `ScheduledSend` (`pending|sending|sent|failed|canceled`, `isUndo` flag) — `prisma db push`ed to Neon + client regenerated. Libs: `lib/scheduledSend.ts` (`deliverScheduledSend` claims a row atomically via `updateMany status:pending→sending` so cron + client-flush never double-send; `processDueSends`), `lib/snooze.ts` (`wakeDueSnoozes`), `lib/timePresets.ts` (client-safe tz-aware presets), `lib/gmail.ts` `modifyThread`. Server actions in `app/(app)/mail/schedule-actions.ts`: `snoozeThread`/`unsnoozeThread`, `deferSend` (undo-window), `scheduleSend` (send-later), `cancelScheduledSend`, `flushScheduledSend`, `catchUpSchedules` (opportunistic wake+flush on inbox render — makes it work despite coarse cron). Crons `snooze-wake` + `scheduled-send` (*/5, CRON_SECRET) added to `vercel.json`. Toast system `components/ui/Toast.tsx` (action + `onExpire` for the undo commit, countdown bar) mounted in layout. UI: `SnoozeMenu` (thread bar + inbox-row icon), `SendBar` (Send w/ undo + Send-later caret, replaces plain buttons in compose & reply), `UnsnoozeButton`, `CancelSendButton`; inbox **Snoozed** + **Scheduled** tabs; keyboard `h` → `SnoozeHotkeyBridge` (snoozes focused thread to "Tomorrow"); undo-window setting (`/settings/mail`, localStorage). **Undo design (chosen):** Send is a deferred `ScheduledSend` row; we stay on the page during the window so Undo trivially preserves the draft; client flushes on expiry, cron is the closed-tab backstop. `pnpm build` + `tsc` clean. **Manual smoke test owed:** snooze a thread → Snoozed tab; schedule a send → Scheduled tab + cancel; send w/ undo → click Undo.



The productivity trio. All three are achievable with Gmail labels + a scheduler cron; no new Corsair ops beyond `messages.modify` / `messages.send` we already use.

### 2a. Snooze
**Deliverable:** snooze a thread (1h / this evening / tomorrow / next week / custom) → it leaves the inbox and reappears at the chosen time.

1. **Schema** (`prisma db push`): `SnoozedThread { id, userId, threadId, gmailMessageId?, snoozeUntil DateTime, createdAt, @@index([userId, snoozeUntil]) }`.
2. **On snooze** (server action `snoozeThread(threadId, until)`): `modifyMessage`/`threads.modify` to `removeLabelIds:["INBOX"]` (optionally add a custom `ZENSCAIL/Snoozed` label via `labels.create` once, then reuse) + insert the row. `revalidatePath("/mail")`.
3. **Wake cron** `app/api/cron/snooze-wake/route.ts` (every 5 min in [vercel.json](../vercel.json), `CRON_SECRET`-guarded): find rows with `snoozeUntil <= now`, `addLabelIds:["INBOX"]` + `removeLabelIds:["ZENSCAIL/Snoozed"]`, delete the row, `publish()` a realtime event so the open inbox refreshes.
4. **UI:** snooze button on thread + inbox row; small preset menu (`components/mail/SnoozeMenu.tsx`); keyboard `h` (Superhuman's snooze key). Optional `/mail?view=snoozed` listing upcoming.

### 2b. Send Later (scheduled send)
**Deliverable:** in compose, "Send later" with presets/custom time → mail goes out at that time.

1. **Schema:** `ScheduledSend { id, userId, to, cc?, subject, body, threadId?, inReplyTo?, sendAt DateTime, status (pending|sent|failed|canceled), createdAt, @@index([userId, sendAt, status]) }`. (Body is user content; fine to store plaintext, or encrypt with `lib/crypto.ts` if we want parity with key handling.)
2. **Compose UI:** split the send button into "Send" + a caret → "Send later" presets (tonight 8pm, tomorrow 8am, Monday 9am, custom). New server action `scheduleSend(formData)` validates and inserts a row (reuse `sendMessage`'s field parsing).
3. **Cron** `app/api/cron/scheduled-send/route.ts` (every 5 min): pick `pending` rows with `sendAt <= now`, call `sendEmail`, mark `sent`/`failed`. Idempotent (status guard prevents double-send).
4. **Outbox view** `/mail?view=scheduled`: list pending sends with a Cancel action (`status → canceled`).

### 2c. Undo Send
**Deliverable:** a few-second window to retract a just-sent email.

1. **Implementation:** make the normal "Send" actually a 5-second deferred send. On click, insert a `ScheduledSend` with `sendAt = now + 5s, status: pending` and show a toast "Sent · Undo" (client timer). "Undo" → server action sets `status: canceled` (and routes back to the draft). The existing send-later cron at 5-min granularity is too coarse — for the undo window, run the actual send from an in-process timer **and** let the cron be the backstop, OR set the undo cron to 1-min and accept a slightly longer worst-case. Simplest robust path for the demo: client holds the toast 5s, then calls `sendMessage`; "Undo" cancels the client timer before it fires (no row needed). Document this as the chosen approach.
2. **Setting:** `/settings` toggle for undo window length (0/5/10/30s); default 5s.

**Demo line:** schedule a send for "in 1 minute," show the outbox, then send one with undo and click Undo to retract.

---

## Feature 3 — Smart bundles / Split inbox 🥈 — ✅ SHIPPED

> **Done.** Schema: added `category String?` to `EmailMeta` (`important|newsletter|social|notification|other`) — `prisma db push`ed to Neon + client regenerated (restart dev server to clear the stale Turbopack-bundled client). Classifier (`lib/ai/classify.ts`): zod schema + system prompt now emit `{ priority, reason, category }` in **one** LLM call (no extra cost vs. priority-only). **Cheap header pre-filter** `heuristicMeta()` categorizes obvious bulk mail with **zero LLM calls** — `CATEGORY_SOCIAL`→social, `List-Unsubscribe`/`CATEGORY_PROMOTIONS`→newsletter, `CATEGORY_FORUMS`/`no-reply@`/`notifications@`/`mailer-daemon`→notification; only ambiguous mail hits the model. `displayCategory()` falls back to the heuristic for rows that predate the column. To expose the signals, `InboxMessage` gained `labelIds: string[]` + `hasListUnsubscribe: boolean` (populated in `hydrate()`). Model used: the same **cheap tier** (`getModelForUser().cheapModel`) — cloud = `gpt-5.4-nano`, BYOK = `cheapModelFor(provider)`. UI: `app/(app)/mail/page.tsx` groups by category and renders `components/mail/BundleSection.tsx` (client) — collapsible 📌 Important · 📰 Newsletters · 👥 Social · 🔔 Notifications · 📥 Everything else, with counts + unread counts, per-category collapse state in localStorage, and **Mark all read / Archive all** batch actions (`bundleAction(ids, op)` loops `modifyMessage` via `Promise.allSettled`). Within a bundle: urgent → unread → recency. `MessageRow` extracted so flat + bundled views share identical row markup. Layout toggle `components/mail/LayoutToggle.tsx` (Bundled ⇄ Flat) persisted in a `mail_layout` cookie the server reads; bundling applies to the **All** view only (Urgent-first/Unread/Snoozed/Scheduled stay flat). `tsc` clean. **Manual smoke test owed:** open `/mail` → mail splits into bundles with counts; collapse/expand persists across reload; toggle Flat ⇄ Bundled; Mark all read / Archive all on a bundle.

Turn the flat inbox into triaged sections using the **existing** AI classifier — minimal new AI cost, big visual payoff.

**Deliverable:** inbox renders grouped sections (📌 Important · 📰 Newsletters · 👥 Social · 🔔 Notifications · Everything else), collapsible, with counts.

1. **Extend classification:** the current classifier emits `priority`. Add a `category` enum to the zod schema in [lib/ai/classify.ts](../lib/ai/classify.ts): `important | newsletter | social | notification | other`. Add `category String?` to `EmailMeta` (`prisma db push`). One LLM call still yields both `{ priority, reason, category }` — no extra calls.
2. **Cheap pre-filter:** before the LLM, classify obvious cases by header heuristics (`List-Unsubscribe` → newsletter; known social domains → social; `no-reply@`/`notifications@` → notification) to save tokens; LLM only for ambiguous mail.
3. **UI:** `app/(app)/mail/page.tsx` groups `InboxMessage[]` by joined `category`; `components/mail/InboxBundles.tsx` renders collapsible sections with counts and a "show all in bundle" link. Respect the existing "Urgent first" toggle (orthogonal — urgent floats within/above bundles).
4. **One-click bundle actions:** "Mark all read" / "Archive all" per bundle (batch via `messages.batchModify` if available, else loop `modifyMessage`).
5. **Toggle:** `/mail?layout=bundled` vs flat; remember preference (cookie or `UserAiSettings`-adjacent setting).

**Demo line:** "23 unread → only 3 are Important; newsletters and notifications are bundled away."

---

## Feature 4 — Instant AI reply chips 🥈 — ✅ SHIPPED

> **Done.** Server action `app/(app)/mail/thread/[id]/suggest.ts` → `suggestReplies(threadId)`: loads the thread (`getThread`), feeds the latest message's sender/subject/body excerpt (text body, capped 2500 chars) to the **cheap model tier** (`getModelForUser().cheapModel`) via `generateObject` (zod `{ suggestions: { label ≤40, draft ≤900 }[] }`, max 3). System prompt forces 3 *distinct-intent* options (accept / propose alternative / clarify / decline), first-person, no greeting/signature, no invented facts. Best-effort: returns `[]` on missing model or any error (wrapped in try/catch) so the thread never breaks. UI `components/mail/ReplyChips.tsx` (client): renders **lazily** — a "Suggest replies" button triggers the fetch (thread open stays instant), then shows 3 numbered chips; clicking (or pressing `1`/`2`/`3` when not typing) pre-fills `#reply-body` via `fillReply()` (sets value + dispatches `input` + focuses + scrolls) — **never auto-sends**, fully editable. Reuses the existing reply `<form>`/`SendBar`. Wired into `thread/[id]/page.tsx` above the reply form; textarea given `id="reply-body"`. Cheat-sheet updated with `1/2/3`. `tsc` clean. **Manual smoke test owed:** open a thread → "Suggest replies" → 3 chips → click one → reply box fills & focuses → edit → send.

One-tap, context-aware reply suggestions at the bottom of a thread — AI directly in the triage flow.

**Deliverable:** opening a thread shows 3 short suggested replies (e.g. "Sounds good 👍", "Propose Thursday 2pm", "Can you share more detail?"). Tapping one expands into a full editable draft in the reply box (not auto-sent).

1. **Server action** `app/(app)/mail/thread/[id]/suggest.ts` → `suggestReplies(threadId)`: load the thread (`getThread`), feed the last message's sender/subject/body excerpt to `cheapModel` via `generateObject` (zod: `{ suggestions: { label, draft }[] }`, 3 items, labels ≤6 words). Best-effort; returns `[]` on no-model/failure.
2. **UI** `components/mail/ReplyChips.tsx` (client): renders chips; clicking a chip pre-fills the reply textarea with `draft` and focuses it. Reuse the existing reply form/`sendMessage`. Keyboard `1/2/3` selects a chip.
3. **Perf:** generate suggestions lazily (on a "Suggest replies" button or after the thread renders via a small client fetch) so thread open stays instant. Cache per `threadId` in memory for the session.
4. **Reuse:** distinct from the existing "Draft reply with AI" (which opens the chat dock for a longer back-and-forth) — chips are instant, inline, zero-typing.

**Demo line:** open a meeting request → tap "Propose Thursday 2pm" → edit one word → send.

---

## Feature 5 — Follow-up reminders 🥈 — ✅ SHIPPED

> **Done.** Schema: `FollowUp { userId, threadId, lastKnownMessageId, subject?, contact?, remindAt, status (waiting|replied|done), note?, surfacedAt? }` — `@@unique([userId, threadId])` (one active per thread, re-arming upserts), `@@index([userId, status, remindAt])`; `prisma db push`ed to Neon + client regenerated. Core `lib/followUp.ts`: `setFollowUp`/`dismissFollowUp`; `processDueFollowUps({userId?})` walks armed rows past `remindAt`, loads the thread, and via `hasInboundReply()` (a message **newer than `lastKnownMessageId` whose From isn't the user's `email`/`connectedEmail`**) either marks `replied` (cleared) or surfaces it once (`surfacedAt` set + `publish()` realtime nudge — guards against duplicate notifications); `listSurfacedFollowUps` (waiting + overdue) powers the banner & brief; `getFollowUp` for the thread button. **Reply detection captures the Gmail message id (`m.id`), not the Message-ID header.** Server actions `app/(app)/mail/follow-up-actions.ts`: `createFollowUp(threadId, days, note?)` (snapshots latest msg id + subject + the most-recent non-self sender as `contact`), `clearFollowUp`. UI: `FollowUpButton` (thread actions bar — day presets 1/2/3/7; when armed shows "Following up <date> · clear"), `FollowUpBanner` (inbox banner "N threads waiting on a reply" — per-thread link + **Draft a nudge** via `openWith()` chat hand-off + dismiss). Cron `app/api/cron/follow-ups/route.ts` (hourly `0 * * * *`, CRON_SECRET) added to `vercel.json` + maxDuration; **opportunistic** `processDueFollowUps({userId})` on inbox render makes it work despite coarse cron. Daily brief (`lib/ai/brief.ts`): surfaced follow-ups **deterministically prepended** as high-urgency action items (no extra tokens, always lead the brief). `tsc` clean. **Scope note:** implemented as a **thread-level** follow-up (reliable + demoable) rather than a compose checkbox — capturing the post-send threadId through the deferred-send pipeline was deemed not worth the fragility for the demo. **Manual smoke test owed:** open a thread → Follow up → In 1 day; set `remindAt` to the past in DB → reload inbox → banner appears → Draft a nudge opens the chat dock; reply to the thread from another account → next render clears it.

Superhuman's signature feature: "remind me if no reply." Pairs naturally with the daily brief.

**Deliverable:** when sending (or on any thread), set "remind me if no reply in X days"; if the thread has no new inbound reply by then, ZenScail surfaces it (inbox banner + daily-brief action item) and offers an AI-drafted nudge.

1. **Schema:** `FollowUp { id, userId, threadId, lastKnownMessageId, remindAt DateTime, status (waiting|replied|done|snoozed), note?, createdAt, @@index([userId, status, remindAt]) }`.
2. **Set reminder:** checkbox in compose ("Remind me if no reply in 3 days") + a thread-level button. Server action inserts `FollowUp { remindAt }` capturing the latest message id in the thread.
3. **Reply detection cron** `app/api/cron/follow-ups/route.ts` (hourly): for `waiting` rows with `remindAt <= now`, `getThread` and check whether a message **newer than `lastKnownMessageId` and not from the user** exists → if yes mark `replied` (clear), else surface it.
4. **Surfacing:** rows that need attention → `publish()` realtime + included as high-urgency **action items in the daily brief** ([lib/ai/brief.ts](../lib/ai/brief.ts) — add a "needs follow-up" source) + an inbox banner "2 threads are waiting on a reply."
5. **AI nudge:** "Draft a follow-up" on a surfaced item → `openWith()` the chat agent with thread context, or inline `suggestReplies`-style nudge draft.

**Demo line:** send an email with follow-up on; fast-forward (manually set `remindAt` past) → it resurfaces with a one-click AI nudge.

---

## Feature 6 — Natural-language quick-add bar 🥉 — ✅ SHIPPED

> **Done.** Server action `app/(app)/quick-add/actions.ts` → `quickAdd(text)`: one **cheap-tier** `generateObject` call (zod object with a `kind` enum `event|email|search|agent` + per-kind fields + a one-line `confirm`) parses the line; system prompt injects current date/time + user email/name and resolves relative dates to absolute ISO. Robust post-processing normalizes/validates (event needs a summary + parseable start, defaults end to +1h; bad/ambiguous → falls back to `agent`). Second action `createQuickEvent()` confirms-and-creates via `createEvent` (returns a result, never redirects). UI `components/command/QuickAddBar.tsx` mounted in the app **header** (`app/(app)/layout.tsx`, hidden < md): Enter parses → **event** shows an inline confirmation popover (Create / Edit details → `/calendar/new` prefilled / Cancel) before any write; **email** → `/mail/compose?to=&subject=&body=` (compose page now reads those searchParams; `RecipientField`/subject prefilled); **search** → `/mail?q=`; **agent** → `openWith()` chat hand-off. Command palette gained a "Booking links" action too. `tsc` clean. **Manual smoke test owed:** type "lunch with Sam tomorrow 1pm" → confirm card → Create; "email dana@x.com the deck is ready" → composer prefilled; "find invoices" → search; vague text → chat dock.

---

## Feature 7 — Scheduling links (Calendly-style) 🥉 — ✅ SHIPPED

> **Done.** Schema: `BookingLink { slug @unique, userId, title, durationMins, windowDays, hoursStart, hoursEnd, timezone, active }` — `prisma db push`ed to Neon + client regenerated (**restart dev server** to clear the stale Turbopack-bundled client). Core `lib/booking.ts`: `mintSlug()` (crypto `randomBytes`, no nanoid dep), timezone-correct slot math (`tzOffsetMs`/`wallClockToInstant` via `Intl` so working-hours are interpreted in the owner's tz), `computeOpenSlots(link, now)` (walks the window in duration steps, drops past + busy-overlapping slots using `getAvailability`, groups by local day, caps per day), `slotIsFree()` (re-check before booking), `getBookingLink()`. Manage UI `/calendar/links`: `BookingLinkForm` (client — captures browser tz via `Intl`, posts `createBookingLink`) + `BookingLinkList` (copy link, preview, turn on/off, delete). Public, **unauthenticated** page `app/book/[slug]/page.tsx` (outside `(app)`, `force-dynamic`) → `SlotPicker` client component (day columns of time chips → name/email → Confirm → success card). Booking action `app/book/[slug]/actions.ts` → `book(slug, slotIso, name, email)`: validates email, looks up the link, **re-checks the slot is still free** (double-book guard), `createEvent` on the owner's tenant with the booker as attendee (`sendUpdates:"all"` via `createEvent`), then `publish()` so the owner's open calendar refreshes. Entry point added to the calendar page header + command palette. `tsc` clean. **Design note:** availability windows are integer hours in the owner's stored timezone; DST seams use the offset at the slot instant (good enough for the demo). **Manual smoke test owed:** create a link → copy → open `/book/<slug>` in a second window → pick a slot → book → event appears on the calendar with the guest invited.

---

## Feature 8 — Smart compose autocomplete 🧪 — ✅ SHIPPED

> **Done.** Endpoint `app/api/compose-complete/route.ts` (POST `{subject,to,body}` → `{completion}`): **cheap-tier** `generateText`, low temp, system prompt forces a short (≤~12 word) continuation only; guards (skip < 2 / > 4000 chars, strip quotes, cap 80 chars); best-effort returns `""` on any failure. UI `components/mail/SmartComposeTextarea.tsx` (client) renders **ghost text** via an underlay div mirroring the textarea (transparent text + gray completion) under a transparent-background textarea sharing identical typography/padding; debounced 550ms with `AbortController` cancel-on-keystroke, only fires when the caret is at the end. **Tab** accepts, **Esc**/typing/blur dismisses; a small "Tab to complete" hint shows while a ghost is present. Wired into the compose page body (`name="body"`, keeps `required`, prefilled from quick-add). **Off by default** — `SmartComposeSetting` toggle in `/settings/mail` (localStorage `zenscail:smartCompose`, mirrors `UndoWindowSetting`) so it never interferes with the live demo unless turned on. `tsc` clean. **Manual smoke test owed:** `/settings/mail` → turn on Smart compose → `/mail/compose` → type a sentence → gray suggestion appears → Tab accepts / Esc dismisses.

---

## Feature 6 (original spec) — Natural-language quick-add bar 🥉

Agent power without opening the full chat — a single bar that parses and executes one-shot commands.

**Deliverable:** a top-bar input ("Try: 'lunch with Sam tomorrow 1pm' or 'email Dana the deck is ready'") that classifies intent and either creates an event, opens a prefilled composer, or hands off to the agent.

1. **Intent parse:** server action `quickAdd(text)` → `generateObject` with `cheapModel`, zod discriminated union: `{ kind: "event", summary, start, end, attendees[] } | { kind: "email", to, subject, body } | { kind: "search", query } | { kind: "agent" }`. System prompt includes current date/time + user email (reuse the chat route's date-resolution wording).
2. **Execute:** `event` → `createEvent` (or route to `/calendar/new` prefilled); `email` → open composer prefilled; `search` → `/mail?q=`; `agent` (anything complex) → `openWith(text)`.
3. **UI** `components/command/QuickAddBar.tsx` in the app header, or fold it into the command palette as the default action when input doesn't match a command (nice unification with Feature 1).
4. **Confirmation:** for create/send, show a one-line confirm ("Create event 'Lunch with Sam' Thu 1–2pm?") before executing — avoids surprise writes (Corsair is in `cautious` mode anyway).

**Demo line:** type "coffee with the Corsair team Friday 10am" → instant event with invite.

---

## Feature 7 — Scheduling links (Calendly-style) 🥉

A calendar-side differentiator: share your availability, let others book.

**Deliverable:** generate a public booking link from your free/busy; a recipient picks a slot; the event is created on your calendar with them as an attendee.

1. **Schema:** `BookingLink { id, slug @unique, userId, title, durationMins, windowDays, hoursStart, hoursEnd, timezone, active, createdAt }`.
2. **Create UI** `/calendar/links`: form (title, duration, working hours, how-far-out). Server action mints a `slug` (nanoid) → shareable URL `https://zenscail.com/book/<slug>`.
3. **Public page** `app/book/[slug]/page.tsx` (NOT under `(app)` — unauthenticated): look up the link, compute open slots from `getAvailability` ([lib/gcal.ts](../lib/gcal.ts)) over the window minus busy times, snapped to the duration. Render a slot picker (date column + times).
4. **Booking** `app/book/[slug]/actions.ts` → `book(slug, slotIso, name, email)`: re-check the slot is still free, then `createEvent` on the owner's tenant with the booker as attendee + `sendUpdates:"all"` (both get the invite). Show a confirmation page.
5. **Guardrails:** rate-limit the public endpoint; validate slot is within window + still free (avoid double-booking race by re-checking availability immediately before create).

**Demo line:** "Here's my booking link" → open it in a second window → book a slot → it appears on the calendar instantly (realtime).

---

## Feature 8 — Smart compose autocomplete 🧪 (stretch)

Inline gray-text completions in the composer; Tab to accept. Flashy but the most finicky to demo — do last.

1. **Endpoint** `app/api/compose-complete/route.ts` (streaming or single-shot): takes the current draft + subject + recipient, returns a short continuation from `cheapModel`. Keep completions ≤ ~12 words; low temperature.
2. **Debounce hard** (400–600ms after typing pause) and cancel in-flight requests on new keystrokes (`AbortController`) to avoid flicker and cost.
3. **UI:** overlay gray "ghost text" after the caret in the composer textarea (a contenteditable or a positioned overlay div). `Tab` accepts, `Esc`/typing dismisses.
4. **Setting:** off by default, toggle in `/settings` (so it never interferes with the live demo unless we want it).

**Risk note:** ghost-text over a textarea is fiddly cross-browser; if time is short, ship a simpler "⌘↵ to autocomplete this sentence" button instead of live ghost text.

---

## Cross-cutting work

- **New env/cron:** add `snooze-wake`, `scheduled-send`, `follow-ups` cron entries to [vercel.json](../vercel.json) (all `CRON_SECRET`-guarded, 1–5 min cadence as noted). On Vercel Hobby, cron granularity is daily-only — confirm the plan supports the needed cadence, or fall back to triggering these checks opportunistically on inbox render + a single frequent cron.
- **Schema migration:** all new models via `pnpm exec prisma db push` (never `migrate`). New tables: `SnoozedThread`, `ScheduledSend`, `FollowUp`, `BookingLink`; new column `EmailMeta.category`.
- **Keyboard:** register new keys in [KeyboardShortcuts.tsx](../components/shortcuts/KeyboardShortcuts.tsx) — `h` snooze, `1/2/3` reply chips, `⌘K` palette; add them to the `?` cheat-sheet.
- **Realtime:** snooze-wake, scheduled-send, and follow-up surfacing all `publish()` so open clients refresh — reuse [lib/realtime.ts](../lib/realtime.ts).
- **Toasts:** Undo Send, "Snoozed until…", "Scheduled for…" need a lightweight toast system — add `components/ui/Toast.tsx` (or `sonner` via `pnpm add sonner`) and mount in the app layout.
- **README:** add the shipped features to the feature table once built.

## Build order (go-big, ship-as-you-go)

```
P0:  1 Command palette   →  2 Snooze/Send Later/Undo
P1:  3 Smart bundles      →  4 Reply chips  →  5 Follow-up reminders
P2:  6 Quick-add bar      →  7 Scheduling links
P3:  8 Smart compose (only if time remains)
```

Each item is independently demoable — stop at any point with a coherent story. After every feature: `pnpm exec tsc --noEmit` clean + manual smoke test against the connected demo account before moving on.
