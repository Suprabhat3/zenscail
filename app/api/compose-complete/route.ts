import { generateText } from "ai";
import { requireSession } from "@/lib/session";
import { getModelForUser } from "@/lib/ai/registry";

export const maxDuration = 15;

/**
 * Smart-compose autocomplete: given the current draft, return a short
 * continuation (≤ ~12 words) for the composer's ghost-text. Cheap tier, low
 * temperature. Best-effort — any failure returns an empty completion so the
 * composer never breaks.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  let payload: { subject?: string; to?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ completion: "" });
  }

  const body = String(payload.body ?? "");
  // Nothing useful to continue from, or the draft is already huge — skip.
  if (body.trim().length < 2 || body.length > 4000) {
    return Response.json({ completion: "" });
  }

  try {
    const { cheapModel } = await getModelForUser(session.user.id);
    const { text } = await generateText({
      model: cheapModel,
      // gpt-5-nano (and other reasoning models) otherwise burn their whole
      // output budget on hidden reasoning and return empty text. Keep reasoning
      // minimal and leave headroom for the actual completion. Ignored by
      // non-OpenAI BYOK providers.
      maxOutputTokens: 256,
      providerOptions: { openai: { reasoningEffort: "minimal" } },
      system: [
        "You autocomplete the user's email as they type, like Gmail Smart Compose.",
        "Continue the draft naturally from exactly where it stops. Return ONLY the continuation text — no quotes, no restating what's written, no greeting/signature.",
        "Keep it to at most ~12 words, ideally finishing the current sentence. If the draft ends mid-word, complete that word first.",
        "If no sensible continuation exists, return an empty string.",
      ].join("\n"),
      prompt: [
        payload.to ? `Recipient: ${payload.to}` : null,
        payload.subject ? `Subject: ${payload.subject}` : null,
        "Draft so far (continue from the end):",
        body,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    // Guard length: never emit more than ~80 chars of ghost text.
    const completion = text.replace(/^\s*["']|["']\s*$/g, "").slice(0, 80);
    return Response.json({ completion });
  } catch {
    return Response.json({ completion: "" });
  }
}
