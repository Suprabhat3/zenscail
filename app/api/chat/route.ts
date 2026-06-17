import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { loadAssistant } from "@/lib/ai/assistant";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body: { messages: UIMessage[]; model?: string } = await req.json();
  const { messages } = body;
  // Cap conversation length as a cheap rate/abuse guard.
  if (!Array.isArray(messages) || messages.length > 100) {
    return new Response("Bad request", { status: 400 });
  }

  // Shared agent setup: the user's model, system prompt, and toolset (Corsair
  // read tools + our review-first composeEmail / scheduleEvent / searchMail).
  const assistant = await loadAssistant({
    overrideModel: typeof body.model === "string" ? body.model : undefined,
  });

  const result = streamText({
    model: assistant.model,
    system: assistant.system,
    messages: await convertToModelMessages(messages),
    tools: assistant.tools as Parameters<typeof streamText>[0]["tools"],
    stopWhen: stepCountIs(15),
    onFinish: assistant.closeAll,
    onError: assistant.closeAll,
    onAbort: assistant.closeAll,
  });

  return result.toUIMessageStreamResponse();
}
