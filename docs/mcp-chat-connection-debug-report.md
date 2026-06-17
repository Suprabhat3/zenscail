# MCP Chat Connection Debug Report

Date: 2026-06-15  
Project: ZenScail  
Area: `app/api/chat/route.ts` (MCP tool connection for Gmail/Google Calendar)

## 1) Problem statement

When users chatted with the assistant and asked it to use Gmail/Calendar tools via MCP, chat logs showed:

- `MCP connect failed MCP SSE Transport Error: 400 Bad Request`
- `MCP unavailable; answering without Gmail/Calendar tools`

This meant the assistant was falling back to text-only mode and could not perform live Gmail/Calendar actions.

## 2) Initial hypothesis

The chat route was using a custom MCP connection strategy:

1. Try HTTP transport first.
2. If HTTP fails, fallback to SSE transport.

Given the error string, the likely issue was not model/tool logic itself, but MCP transport negotiation/session handling.

## 3) What we checked before implementing the fix

### A. Code-path verification

We reviewed:

- `app/api/chat/route.ts`
- `lib/ai/corsair-mcp.ts`
- `lib/corsair.ts`
- `docs/corsair.md`
- `docs/implementation-plan.md`
- `docs/corsair-reference.md`

Key finding: chat used a manual transport builder and explicit SSE fallback, not just SDK defaults.

### B. Reproduction with existing probe script

We ran:

- `pnpm exec tsx --env-file=.env scripts/mcp-probe.mts`

Observed behavior:

- HTTP (SDK createVercelClient): sometimes `404 Session not found` (previously), later succeeded during retest.
- Custom HTTP transport: succeeded in repeated runs.
- SSE transport: consistently failed with `400 Bad Request`.

### C. MCP endpoint behavior check

We tested the hosted MCP endpoint directly (curl, with auth headers).

Important response body from SSE-style GET:

- `{"error":"Missing or invalid mcp-session-id"}`

This was the critical clue: direct SSE bootstrap at that endpoint expected/required an MCP session id and was not valid as a generic fallback path in this environment.

### D. SDK behavior check

We inspected installed package sources/types:

- `@corsair-dev/app@0.1.5`
- `@ai-sdk/mcp@1.0.48`

Findings:

- Corsair config helper resolves to HTTP transport config.
- The repo’s SSE fallback was custom and not guaranteed to match what this hosted endpoint expects.
- In this project’s environment, SSE fallback was reliably invalid while HTTP worked.

## 4) Root cause

The chat route’s fallback strategy was incorrect for this hosted Corsair MCP endpoint.

- When HTTP had transient errors, code switched to SSE.
- SSE endpoint path/handshake here returned `400` (`missing/invalid mcp-session-id`).
- That caused MCP initialization to fail and tools were disabled for the chat response.

So, the user-facing failure was not “Gmail/Calendar tools broken”, but “transport fallback path invalid for this deployment”.

## 5) Fix implemented

### File changed: `app/api/chat/route.ts`

1. Removed SSE fallback logic from MCP connection flow.
2. Standardized on HTTP-only connection for this route.
3. Kept existing resilient reconnect/retry behavior and increased HTTP retry attempts.
4. Improved transport config header merge logic:
   - respect `cfg.headers` from Corsair config
   - add tenant header only if missing
   - add Authorization only if missing

### Diagnostic script update: `scripts/mcp-probe.mts`

Added a tenant-key HTTP probe path (`tenant.mcpKeys.create`) for future debugging and corrected key cleanup method:

- from non-existent `delete(...)`
- to correct `revoke(...)`

## 6) Validation after fix

### Commands run

1. `pnpm exec tsx --env-file=.env scripts/mcp-probe.mts`
2. `pnpm exec tsc --noEmit`

### Results

- HTTP via SDK client: OK
- HTTP via tenant key: OK
- HTTP via custom transport repeated runs: OK
- SSE: still fails with `400` (expected, and no longer used by chat)
- Typecheck: pass
- Lints on touched files: no errors

## 7) Why this fix is safe

- It removes only the failing fallback branch (SSE) for this route.
- It does not change Gmail/Calendar business logic, tool invocation flow, or user data model.
- It preserves retry and reconnect behavior for transient HTTP MCP errors.
- It aligns actual runtime behavior with what works reliably in this environment.

## 8) How another engineer can verify quickly

1. Start app: `pnpm dev`
2. Open chat and issue a tool-requiring prompt, for example:
   - “List my Gmail labels.”
   - “Check my calendar events for tomorrow.”
3. Confirm there is no log:
   - `MCP SSE Transport Error: 400 Bad Request`
4. Optionally run:
   - `pnpm exec tsx --env-file=.env scripts/mcp-probe.mts`
   - confirm HTTP paths are OK.

## 9) Follow-up recommendations

1. Keep this environment on HTTP-only MCP unless Corsair documents/guarantees SSE behavior for this endpoint.
2. If future SDK/Corsair updates are applied, re-run `scripts/mcp-probe.mts` before changing transport strategy again.
3. Consider adding a tiny health check endpoint or CI smoke script that validates MCP tools can be listed for one tenant.

---

## 10) Addendum (2026-06-15, second pass) — actual root cause + real fix

The HTTP-only change in section 5 was correct but did not stop the failures.
Chat still logged:

- `chat: MCP connect failed Corsair MCP POST failed (HTTP 404): {"error":"Session not found"}`
- `chat: MCP unavailable; answering without Gmail/Calendar tools`

### What we did differently

We ran a **raw handshake probe** (initialize → notifications/initialized →
tools/list), printing every status code and header, and then repeated each
sequence many times.

### Key observations

1. `initialize` always returns `HTTP 200` with a fresh `mcp-session-id`.
2. Immediately after, the *next* POST (with that exact session id) sometimes
   returns `HTTP 404 {"error":"Session not found"}`.
3. This is **time-windowed**, not request-shaped:
   - During one window, **all** transports failed 100% (SDK
     `createVercelClient`, tenant-key HTTP, our custom POST transport — every
     fresh session 404'd on its second request).
   - Minutes later, **all** of them succeeded 20/20, with and without
     `notifications/initialized`, with or without holding the GET SSE stream.
4. SSE still fails with `400` — genuinely unsupported, unrelated to this bug.

### Real root cause

Corsair's hosted MCP **session store is intermittently inconsistent**. A
session created by `initialize` is not reliably visible to the node that
serves the next POST for a short window (seconds), so that POST 404s even
though the session id is valid. After the window passes, brand-new sessions
work again.

The user-facing failure was therefore: *the chat route gave up too fast*. Its
retry loop made 4 attempts **with no delay** (all within ~1 second), which
cannot outlast even a brief bad window, so it fell back to text-only mode.

### Fix implemented (this pass)

File: `app/api/chat/route.ts` — `connectMcp()`

- Re-initialize (fresh session each try) with **exponential backoff + jitter**
  (≈0.3s → 4.8s, ~10s total) instead of a no-delay burst.
- Increased attempts from 4 to 6.
- Log how many attempts a successful connect needed (visibility into windows).
- No change to transport, auth headers, or Gmail/Calendar business logic.

### Validation

- `pnpm exec tsx --env-file=.env scripts/mcp-probe.mts`: HTTP paths OK (SDK,
  tenant-key, custom ×5), SSE still 400 (expected/unused).
- `pnpm exec tsc --noEmit`: pass. No new lints.

### Note for the next engineer

If you still see `Session not found` failures during a sustained Corsair
outage window (minutes, not seconds), that is upstream — no client retry can
fix it. Confirm with the raw/probe scripts before changing transport strategy.

---

## 11) Addendum (2026-06-17, third pass) — why it was still ~50%, and the real fix

Users still hit `Session not found` ~50% of the time. New investigation (live
stress probe) pinned down two compounding facts:

1. **Corsair's MCP exposes only 3 generic meta-tools** — `list_operations`,
   `get_schema`, `run_script` — not per-operation Gmail/Calendar tools. So every
   agent action is a *chain* of session POSTs (discover → schema → run). Each
   POST independently risks the bad-session window, so the per-action failure
   probability compounds toward ~50%.
2. **The handshake itself is reliable when Corsair is healthy.** A stress run
   during a good window: 30/30 fresh `initialize → tools/list`, 0 races, 20/20
   calls on a warmed session. By contrast the **stateless `tenant.run()` REST
   path** (what the whole app uses for inbox/calendar) was 20/20 and never
   races — it has no session to lose. The flakiness is purely Corsair's
   *stateful MCP session layer*, not our transport code.

Two latent bugs found while here:

- **`WRITE_TOOL_RE` was dead code.** It filtered tools by names like
  `messages.send`, but the only tool names are `list_operations`/`get_schema`/
  `run_script` — none matched. So the agent could `run_script` a
  `gmail.api.messages.send` and **bypass the review-first compose flow**.
- The "MCP unavailable → no read tools, answer text-only" fallback made a bad
  Corsair window look like a total agent failure.

### Fix implemented (`lib/ai/assistant.ts`)

- **MCP stays primary** (it's the high-value bonus: "agent chat using Corsair
  MCP", per `docs/faq.md` / `docs/requirement.md`).
- **Direct `tenant.run()` fallback read tools** (`searchInbox`, `readThread`,
  `listCalendarEvents`, `checkAvailability`) kick in only when MCP can't be
  reached, so a bad Corsair window degrades to the reliable REST path instead of
  dropping all read tools. Built on the same helpers the app already uses
  (`lib/gmail.ts`, `lib/gcal.ts`) — smoke-tested live.
- **Shorter MCP connect window** (4 attempts ≈2s, was 6 ≈10s): with a reliable
  fallback, fail over fast rather than make the user wait.
- **`guardMcpWrites`** wraps `run_script` and refuses any mutating op
  (`WRITE_OP_RE`), steering the agent to `composeEmail`/`scheduleEvent`. Restores
  the never-auto-send guarantee that `WRITE_TOOL_RE` no longer provided.

### Validation

- `pnpm exec tsc --noEmit`: pass. `eslint lib/ai/assistant.ts`: clean.
- Live: stateless `gmail.api.messages.list` + `googlecalendar.api.events.getMany`
  + `gmail.api.labels.list` succeed 20/20 — the fallback rests on proven ops.

---

If handoff requires exact code diff context, reference:

- `lib/ai/assistant.ts` (MCP-first + tenant.run() fallback + run_script guard)
- `app/api/chat/route.ts`
- `scripts/mcp-probe.mts`
