"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { getAppIdentityForUser } from "@/lib/identity";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getModelForUser } from "@/lib/ai/registry";
import { getThread, extractBodies, header } from "@/lib/gmail";

export type ReplySuggestion = { label: string; draft: string };

const SuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        label: z.string().max(40),
        draft: z.string().max(900),
      }),
    )
    .max(3),
});

const SYSTEM = `You suggest quick replies to the latest message in an email thread, on behalf of the user who received it.

Return exactly 3 distinct, useful reply options that a busy professional might plausibly want to send. They should cover meaningfully different intents (e.g. agree/accept, propose an alternative, ask a clarifying question, or decline politely) — not three rewordings of the same thing.

For each option:
- "label": a tight summary of the reply's intent, max 6 words (e.g. "Sounds good", "Propose Thursday 2pm", "Ask for more detail"). No trailing punctuation.
- "draft": the full reply body the user could send as-is — natural, warm, concise (1–4 sentences). Write in the user's first-person voice. Do NOT include a subject line, a greeting line with the recipient's full email, or a signature; just the message body. Plain text only.

Be specific to the actual content of the message. Never invent facts (dates, prices, commitments) the thread doesn't support — if proposing a time, keep it clearly tentative.`;

/**
 * Generate 3 short, context-aware reply suggestions for a thread's latest
 * message. Best-effort: returns [] on a missing model or any failure so the
 * thread UI never breaks. Uses the cheap model tier — same as the classifier.
 */
export async function suggestReplies(threadId: string): Promise<ReplySuggestion[]> {
  if (!threadId) return [];

  try {
    const session = await requireSession();
    const identity = await getAppIdentityForUser(session.user.id, session.user);
    const tenantId = await ensureCorsairTenant(session.user.id);
    const t = corsairTenant(tenantId);

    const result = await getThread(t, threadId);
    if (!result.success) return [];
    const messages = result.data.messages ?? [];
    if (messages.length === 0) return [];

    const last = messages[messages.length - 1];
    const from = header(last.payload, "From");
    const subject = header(messages[0].payload, "Subject") || "(no subject)";
    const bodies = extractBodies(last.payload);
    const body = (bodies.text || last.snippet || "").replace(/\s+\n/g, "\n").slice(0, 2500);

    let cheapModel;
    try {
      ({ cheapModel } = await getModelForUser(session.user.id));
    } catch {
      return [];
    }

    const { object } = await generateObject({
      model: cheapModel,
      schema: SuggestionsSchema,
      system: SYSTEM,
      prompt: `You are replying on behalf of ${identity.primaryEmail}.

From: ${from}
Subject: ${subject}

Latest message:
${body}`,
    });

    return object.suggestions.slice(0, 3);
  } catch {
    return [];
  }
}
