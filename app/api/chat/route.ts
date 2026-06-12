import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getModelForUser } from "@/lib/ai/registry";

export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);

  const { messages }: { messages: UIMessage[] } = await req.json();
  // Cap conversation length as a cheap rate/abuse guard.
  if (!Array.isArray(messages) || messages.length > 100) {
    return new Response("Bad request", { status: 400 });
  }

  const { model } = await getModelForUser(session.user.id);
  const mcpClient = await corsairTenant(tenantId).mcp.createVercelClient();
  const tools = await mcpClient.tools();

  const now = new Date();
  // Do NOT list Corsair operation names here — the MCP server handles discovery.
  const system = [
    "You are ZenScail, an assistant that manages the user's Gmail and Google Calendar using the tools available to you.",
    `Current date and time: ${now.toISOString()} (${now.toUTCString()}).`,
    `The user's email address is ${session.user.email}; their name is ${session.user.name}.`,
    "Resolve relative dates ('next Thursday', 'tomorrow at 9') against the current date above. If a timezone matters and is ambiguous, ask.",
    "Before sending email or creating/modifying events, state what you're about to do. Report what you actually did, including failures.",
    "Keep replies short and practical.",
  ].join("\n");

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(15),
    onFinish: async () => {
      await mcpClient.close?.();
    },
  });

  return result.toUIMessageStreamResponse();
}
