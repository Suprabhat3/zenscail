import { z } from "zod";
import { isValidModel, type AiProvider } from "@/lib/ai/models";

/**
 * Shared zod schemas + helpers for validating untrusted input at every
 * boundary (API route bodies, server-action arguments, form submissions).
 *
 * The rule: nothing that crosses a trust boundary should be consumed via a
 * bare `as` cast or hand-rolled `String(...)` coercion — parse it with a schema
 * here so the runtime shape and the TypeScript type can never drift apart.
 */

/** Email shape used across booking, the waitlist, and recipient fields. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lower-cased email. Use `.safeParse` where you want a friendly message. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(EMAIL_RE, "Please enter a valid email address.");

/** AI provider id — kept in lockstep with `AiProvider` in lib/ai/models. */
export const providerSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "groq",
]) satisfies z.ZodType<AiProvider>;

/**
 * A `{ provider, model }` pair where the model must belong to that provider's
 * curated list. Replaces the old `parseProvider` + `isValidModel` two-step.
 */
export const providerModelSchema = z
  .object({ provider: providerSchema, model: z.string() })
  .refine((v) => isValidModel(v.provider, v.model), {
    error: "Unknown model for the selected provider.",
    path: ["model"],
  });

/**
 * HTML checkbox coercion: an unchecked box is simply absent from the form, a
 * checked one sends a truthy token (`"on"` by default, sometimes `"yes"`).
 * Anything else → false.
 */
export function formCheckbox(truthy: string = "on") {
  return z.preprocess((v) => v === truthy || v === true, z.boolean());
}

/**
 * A bounded integer parsed from form text: non-numeric input falls back, and
 * the result is clamped to `[min, max]`. Mirrors the old `clampInt` helper.
 */
export function clampedInt(fallback: number, min: number, max: number) {
  return z.preprocess(
    (v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? n : fallback;
    },
    z.number().transform((n) => Math.min(max, Math.max(min, n))),
  );
}

/**
 * Validate an untrusted JSON request body. Returns `null` on malformed JSON or
 * a shape that fails the schema, so callers keep their own error response and
 * best-effort fallbacks (an empty completion, a 400, an ack, …).
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T> | null> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Parse a `FormData` against a schema. Repeated keys collapse to their last
 * value (use `formData.getAll` directly for genuine multi-value fields). Throws
 * a `ZodError` on failure — wrap in `safeParse` at sites that redirect instead.
 */
export function parseFormData<T extends z.ZodTypeAny>(
  form: FormData,
  schema: T,
): z.infer<T> {
  return schema.parse(Object.fromEntries(form.entries()));
}
