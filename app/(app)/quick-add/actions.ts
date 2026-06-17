"use server";

import { randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { getAppIdentityForUser, mailboxContextLine } from "@/lib/identity";
import { getModelForUser } from "@/lib/ai/registry";
import { runAgentCommand } from "@/lib/ai/assistant";
import { saveConversation } from "@/app/(app)/chat/history-actions";

/**
 * Result of a quick-bar command. Either we resolved it to a concrete page to
 * open (a pre-filled compose / new-event screen, or filtered search), or it's a
 * conversation that belongs in the assistant dock.
 */
export type QuickResult =
  | { kind: "navigate"; url: string; label: string }
  | { kind: "chat"; text: string };

const ClassifySchema = z.object({
  kind: z
    .enum(["search", "action"])
    .describe(
      "search: the user just wants to find or browse existing emails. action: anything else — drafting/replying/sending email, scheduling events, questions, or multi-step tasks.",
    ),
  query: z.string().nullable().describe("Search terms (search only)."),
});

/** Persist a quick command as a short conversation in the shared chat history. */
async function saveQuickCommand(command: string, summary: string): Promise<void> {
  await saveConversation({
    id: randomUUID(),
    messages: [
      { id: randomUUID(), role: "user", parts: [{ type: "text", text: command }] },
      { id: randomUUID(), role: "assistant", parts: [{ type: "text", text: summary }] },
    ],
  });
}

/**
 * Drive a single natural-language command from the quick-add bar. A cheap-model
 * pass fast-paths plain searches; everything else runs through the shared agent
 * (`runAgentCommand`), which finds the right person/thread, drafts the full
 * email or event, and returns a directive to a pre-filled review screen. The
 * command + outcome is saved to the same history as the assistant dock.
 */
export async function runQuickCommand(text: string): Promise<QuickResult> {
  const trimmed = z.string().catch("").parse(text).trim();
  if (!trimmed) return { kind: "chat", text: trimmed };

  const session = await requireSession();

  // Cheap classify: fast-path obvious searches, hand the rest to the agent.
  let kind: "search" | "action" = "action";
  let query = trimmed;
  try {
    const identity = await getAppIdentityForUser(session.user.id, session.user);
    const { cheapModel } = await getModelForUser(session.user.id);
    const { object } = await generateObject({
      model: cheapModel,
      schema: ClassifySchema,
      system: [
        "Classify a single line from an email + calendar app's command bar.",
        mailboxContextLine(identity),
      ].join("\n"),
      prompt: trimmed,
    });
    kind = object.kind;
    if (object.query) query = object.query;
  } catch {
    // Classification failed — treat as an action and let the agent decide.
  }

  if (kind === "search") {
    await saveQuickCommand(trimmed, `Searched mail for “${query}”.`).catch(() => {});
    return { kind: "navigate", url: `/mail?q=${encodeURIComponent(query)}`, label: `Search “${query}”` };
  }

  // Drafting / scheduling / lookups — run the shared agent to completion.
  let directive = null;
  let reply = "";
  try {
    const result = await runAgentCommand(trimmed);
    directive = result.directive;
    reply = result.text;
  } catch {
    return { kind: "chat", text: trimmed };
  }

  if (directive) {
    await saveQuickCommand(trimmed, `${directive.label} — opened for you to review.`).catch(() => {});
    return { kind: "navigate", url: directive.url, label: directive.label };
  }

  // No concrete action — continue in the assistant dock.
  return { kind: "chat", text: reply || trimmed };
}
