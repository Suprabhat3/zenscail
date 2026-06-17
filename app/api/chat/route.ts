import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { loadAssistant } from "@/lib/ai/assistant";
import { parseJsonBody } from "@/lib/validation";

export const maxDuration = 120;

// Structural guard only: each turn must be an object carrying a known role.
// `.loose()` keeps the SDK's richer UIMessage fields (parts, id, …) intact —
// we runtime-check the invariants we depend on and let the SDK own the rest.
const ChatBodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["system", "user", "assistant"]) }).loose())
    .max(100, "Too many messages."),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await parseJsonBody(req, ChatBodySchema);
  // Bad JSON, wrong shape, or over the conversation-length abuse cap.
  if (!body) {
    return new Response("Bad request", { status: 400 });
  }

  // Shared agent setup: the user's model, system prompt, and toolset (Corsair
  // read tools + our review-first composeEmail / scheduleEvent / searchMail).
  const assistant = await loadAssistant({ overrideModel: body.model });

  const result = streamText({
    model: assistant.model,
    system: assistant.system,
    // Validated structurally above; the elements carry the full UIMessage shape.
    messages: await convertToModelMessages(body.messages as unknown as UIMessage[]),
    tools: assistant.tools as Parameters<typeof streamText>[0]["tools"],
    stopWhen: stepCountIs(15),
    onFinish: assistant.closeAll,
    onError: assistant.closeAll,
    onAbort: assistant.closeAll,
  });

  return result.toUIMessageStreamResponse();
}
