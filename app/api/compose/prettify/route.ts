import { generateText } from "ai";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { getModelForUser } from "@/lib/ai/registry";
import { parseJsonBody } from "@/lib/validation";

export const maxDuration = 30;

const PrettifyDraftSchema = z.object({
  body: z.string().optional(),
  subject: z.string().optional(),
  to: z.string().optional(),
});

/**
 * AI "Prettify": turn a plain-text (or lightly-formatted HTML) draft into a
 * polished, inline-styled HTML email fragment for the rich composer. The branded
 * ZenScail card shell is applied at send time (see deliverScheduledSend), so we
 * return only the editable inner fragment here. Returns an empty body on any
 * failure so the composer never loses the user's text.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  const payload = await parseJsonBody(req, PrettifyDraftSchema);
  if (!payload) {
    return Response.json({ html: "" }, { status: 400 });
  }

  const body = String(payload.body ?? "").trim();
  if (!body || body.length > 12000) {
    return Response.json({ html: "" }, { status: 400 });
  }

  try {
    const { model } = await getModelForUser(session.user.id);
    const { text } = await generateText({
      model,
      maxOutputTokens: 4000,
      system: [
        "You convert a plain email draft into a polished, professional HTML email body.",
        "Return ONLY an HTML fragment (no <html>, <head>, <body>, or markdown fences) — it will be placed inside a branded card.",
        "Rules:",
        "- Preserve the author's words, meaning, and intent. You may lightly tidy grammar/spacing but DO NOT add new claims, facts, or change the message.",
        "- Use semantic, well-spaced structure: <p> for paragraphs, <ul>/<li> for lists, <strong>/<em> for emphasis, <a href> for links.",
        "- Every element MUST use inline style attributes only (no <style> blocks, no classes) for mail-client compatibility.",
        "- Use a clean sans-serif font stack and comfortable line-height. Keep colors tasteful and readable (dark ink text, e.g. #25201A; accent #E11D48 for links/headings if useful).",
        "- Keep the greeting and sign-off if present; do not invent a signature that isn't there.",
      ].join("\n"),
      prompt: [
        payload.to ? `Recipient: ${payload.to}` : null,
        payload.subject ? `Subject: ${payload.subject}` : null,
        "Draft to convert into a styled HTML email body:",
        body,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    let fragment = text.trim();
    // Strip accidental markdown code fences or full-document wrappers.
    fragment = fragment.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "");
    const inner = fragment.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (inner) fragment = inner[1].trim();
    if (!fragment) return Response.json({ html: "" }, { status: 422 });

    return Response.json({ html: fragment });
  } catch {
    return Response.json({ html: "" }, { status: 500 });
  }
}
