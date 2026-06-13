"use server";

import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { listInboxMessages, type InboxMessage } from "@/lib/gmail";

export type CommandSearchResult = Pick<
  InboxMessage,
  "id" | "threadId" | "from" | "subject" | "snippet"
>;

/**
 * Search the connected mailbox for the command palette. Best-effort: returns an
 * empty array when the tenant isn't connected or the query is too short, rather
 * than redirecting (the palette is an overlay, not a page).
 */
export async function searchInbox(query: string): Promise<CommandSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const { ok, messages } = await listInboxMessages(t, { query: q, limit: 6 });
  if (!ok) return [];

  return messages.slice(0, 6).map((m) => ({
    id: m.id,
    threadId: m.threadId,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
  }));
}
