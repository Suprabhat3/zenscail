import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { getComposeModelForUser } from "./registry";

const CompletionSchema = z.object({
  completion: z
    .string()
    .max(80)
    .describe(
      "Short continuation from the end of the draft (~12 words max). Empty string if none.",
    ),
});

const SYSTEM = [
  "You autocomplete the user's email as they type, like Gmail Smart Compose.",
  "Continue the draft naturally from exactly where it stops.",
  "Keep it to at most ~12 words, ideally finishing the current sentence.",
  "If the draft ends mid-word, complete that word first.",
  "If no sensible continuation exists, return an empty string.",
  "Never repeat text already in the draft. Never add quotes, greeting, or signature.",
].join("\n");

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

/** Strip quotes, repetition, and cap length so ghost text stays safe to show. */
export function normalizeCompletion(body: string, raw: string): string {
  let s = raw.trim().replace(/^\s*["']|["']\s*$/g, "");
  if (!s) return "";
  if (s.startsWith(body)) s = s.slice(body.length).trimStart();
  const bodyLower = body.toLowerCase();
  const sLower = s.toLowerCase();
  if (bodyLower.endsWith(sLower) && s.length < body.length) return "";
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
  const providerOptions =
    resolved.provider === "openai"
      ? { openai: { reasoningEffort: "minimal" as const } }
      : undefined;

  try {
    const { object } = await generateObject({
      model: resolved.model,
      schema: CompletionSchema,
      maxOutputTokens: 128,
      ...(providerOptions ? { providerOptions } : {}),
      system: SYSTEM,
      prompt,
    });
    return normalizeCompletion(opts.body, object.completion);
  } catch {
    if (resolved.provider !== "openai" || !providerOptions) return "";
    try {
      const { object } = await generateObject({
        model: resolved.model,
        schema: CompletionSchema,
        maxOutputTokens: 128,
        system: SYSTEM,
        prompt,
      });
      return normalizeCompletion(opts.body, object.completion);
    } catch {
      return "";
    }
  }
}
