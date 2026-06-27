import { z } from "zod";
import { completeDraft } from "@/lib/ai/compose-complete";
import { checkUserAiLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";

export const maxDuration = 15;

const ComposeDraftSchema = z.object({
  subject: z.string().optional(),
  to: z.string().optional(),
  body: z.string().optional(),
});

/**
 * Smart-compose autocomplete: given the current draft, return a short
 * continuation (≤ ~12 words) for the composer's ghost-text. Best-effort —
 * any failure returns an empty completion so the composer never breaks.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ completion: "" }, { status: 401 });
  }

  if (!checkUserAiLimit(session.user.id).ok) {
    return Response.json({ completion: "" }, { status: 429 });
  }

  const payload = await parseJsonBody(req, ComposeDraftSchema);
  if (!payload) {
    return Response.json({ completion: "" }, { status: 400 });
  }

  const body = String(payload.body ?? "");
  if (body.trim().length < 2 || body.length > 4000) {
    return Response.json({ completion: "" });
  }

  const completion = await completeDraft({
    userId: session.user.id,
    body,
    subject: payload.subject,
    to: payload.to,
  });

  return Response.json({ completion });
}
