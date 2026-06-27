import "server-only";

import { generateText } from "ai";
import type { AiProvider } from "./models";
import { getComposeModelForUser } from "./registry";

const SYSTEM = [
  "You are Gmail Smart Compose: you predict the next few words of the email the user is typing.",
  "Always output a continuation — never refuse, never return nothing. Make your best guess even from very little text.",
  "Output ONLY the raw continuation text that comes right after the draft. No quotes, no explanation, no JSON, no labels.",
  "Keep it short: 2-8 words, just enough to be useful. Prefer finishing the current word/phrase/sentence.",
  "If the draft ends mid-word, finish that word first (start your output with the rest of the word, no leading space).",
  "Otherwise start with a leading space if a space belongs between the draft and your continuation.",
  "Never repeat words already at the end of the draft. Never add a greeting or signature.",
].join("\n");

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/**
 * Provider options that hard-disable hidden "thinking" so the model spends its
 * whole (small) token budget on the actual completion, not reasoning. Without
 * this, reasoning models burn the budget and emit nothing.
 */
function noThinkingOptions(
  provider: AiProvider,
): Record<string, Record<string, JsonValue>> | undefined {
  switch (provider) {
    case "openai":
      return { openai: { reasoningEffort: "none" } };
    case "google":
      return { google: { thinkingConfig: { thinkingBudget: 0 } } };
    // anthropic and groq don't think unless explicitly enabled.
    case "anthropic":
    case "groq":
      return undefined;
  }
}

function buildPrompt(body: string, subject?: string, to?: string): string {
  return [
    to ? `Recipient: ${to}` : null,
    subject ? `Subject: ${subject}` : null,
    "Draft so far (continue from the end):",
    body,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Strip quotes, repetition, and cap length so ghost text stays safe to show.
 * Preserves a single leading space when the model decided one belongs between
 * the draft and the continuation (the client appends `body + ghost` verbatim),
 * but never adds a space mid-word.
 */
export function normalizeCompletion(body: string, raw: string): string {
  // The model is told to output only the continuation, but strip an accidental
  // surrounding quote and any trailing whitespace/newlines. Keep leading space.
  let s = raw.replace(/[\r\n]+/g, " ").replace(/\s+$/g, "");
  s = s.replace(/^\s*["']/, "").replace(/["']$/, "");
  // Collapse any leading whitespace to at most one space.
  const hadLeadingSpace = /^\s/.test(s);
  s = s.replace(/^\s+/, hadLeadingSpace ? " " : "");
  if (!s.trim()) return "";

  // Model echoed the whole draft back — keep only the new tail.
  if (s.startsWith(body)) s = s.slice(body.length);
  if (!s.trim()) return "";

  const bodyLower = body.toLowerCase();
  const sLower = s.trim().toLowerCase();
  // Pure repetition of what's already typed → nothing useful.
  if (bodyLower.endsWith(sLower) && sLower.length < body.length) return "";
  if (sLower === bodyLower.trim()) return "";

  return s.slice(0, 80);
}

/**
 * Return a short ghost-text continuation for the compose body. Best-effort:
 * always resolves to a string (empty on any failure) so the composer never breaks.
 */
export async function completeDraft(opts: {
  userId: string;
  body: string;
  subject?: string;
  to?: string;
}): Promise<string> {
  const resolved = await getComposeModelForUser(opts.userId);
  if (!resolved) return "";

  const prompt = buildPrompt(opts.body, opts.subject, opts.to);
  const providerOptions = noThinkingOptions(resolved.provider);

  try {
    const { text } = await generateText({
      model: resolved.model,
      // Plain text (no JSON schema) is far more reliable for tiny completions:
      // nothing to parse, nothing to leave empty. Headroom so output isn't truncated.
      maxOutputTokens: 64,
      ...(providerOptions ? { providerOptions } : {}),
      system: SYSTEM,
      prompt,
    });
    return normalizeCompletion(opts.body, text);
  } catch {
    return "";
  }
}
