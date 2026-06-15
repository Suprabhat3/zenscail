"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** A chat message as the client persists/restores it (UIMessage subset). */
export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type LoadedConversation = {
  id: string;
  messages: StoredMessage[];
  /** messageId → "up" | "down" for assistant replies the user rated. */
  feedback: Record<string, "up" | "down">;
};

/** Pull the first user message's text to use as the conversation title. */
function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = textOf(firstUser?.parts);
  const clean = text.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 70) : "New conversation";
}

function textOf(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        !!p && typeof p === "object" && (p as { type?: string }).type === "text",
    )
    .map((p) => p.text)
    .join(" ");
}

/**
 * Persist the whole conversation (called from the dock's onFinish). Upserts the
 * conversation row + every message; never clobbers a message's feedback. The
 * title is set once (from the first user turn) and left alone afterward.
 * Best-effort: returns false on any failure so chat never breaks.
 */
export async function saveConversation(input: {
  id: string;
  messages: StoredMessage[];
}): Promise<boolean> {
  const { id, messages } = input;
  if (!id || !Array.isArray(messages) || messages.length === 0) return false;
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const existing = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (existing && existing.userId !== userId) return false;

    await prisma.conversation.upsert({
      where: { id },
      create: { id, userId, title: deriveTitle(messages) },
      update: { updatedAt: new Date() },
    });

    // Upsert each message; on update we only refresh `parts` so streamed-in
    // tool results land, but we never touch `feedback`.
    await Promise.all(
      messages.map((m) =>
        prisma.chatMessage.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            conversationId: id,
            role: m.role,
            parts: m.parts as object,
          },
          update: { parts: m.parts as object },
        }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

/** Recent conversations for the history panel (newest first). */
export async function listConversations(): Promise<ConversationSummary[]> {
  try {
    const session = await requireSession();
    const rows = await prisma.conversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, updatedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title || "New conversation",
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Load one conversation's messages + feedback for restoring into the dock. */
export async function getConversation(id: string): Promise<LoadedConversation | null> {
  if (!id) return null;
  try {
    const session = await requireSession();
    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!convo || convo.userId !== session.user.id) return null;

    const rows = await prisma.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, parts: true, feedback: true },
    });

    const feedback: Record<string, "up" | "down"> = {};
    for (const r of rows) {
      if (r.feedback === "up" || r.feedback === "down") feedback[r.id] = r.feedback;
    }

    return {
      id,
      messages: rows.map((r) => ({
        id: r.id,
        role: r.role as StoredMessage["role"],
        parts: r.parts,
      })),
      feedback,
    };
  } catch {
    return null;
  }
}

/** Set / clear a thumbs up/down on an assistant message. */
export async function setMessageFeedback(
  messageId: string,
  feedback: "up" | "down" | null,
): Promise<boolean> {
  if (!messageId) return false;
  try {
    const session = await requireSession();
    // Scope the update to the caller's own conversations.
    const msg = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { conversation: { select: { userId: true } } },
    });
    if (!msg || msg.conversation.userId !== session.user.id) return false;
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { feedback },
    });
    return true;
  } catch {
    return false;
  }
}

/** Delete a conversation (and its messages, via cascade). */
export async function deleteConversation(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const session = await requireSession();
    const res = await prisma.conversation.deleteMany({
      where: { id, userId: session.user.id },
    });
    return res.count > 0;
  } catch {
    return false;
  }
}
