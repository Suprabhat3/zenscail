"use server";

import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { listInboxMessages } from "@/lib/gmail";
import { classifyMessages } from "@/lib/ai/classify";

/**
 * Lightweight inbox sync, called by the client poll (~every 60s) ONLY while the
 * user is on a mail page. We don't trust the Corsair webhook to fire reliably,
 * so this is the real freshness mechanism. It re-lists the inbox (one cheap
 * messages.list), which hydrates + caches any new mail and classifies it, then
 * returns a compact signature. The client compares signatures and triggers a
 * router.refresh() only when something actually changed — so a quiet inbox
 * costs one list call per minute and no re-render.
 */
export async function pollInbox(): Promise<{ ok: boolean; signature: string }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, signature: "" };
  }
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const { ok, messages } = await listInboxMessages(t, { userId, limit: 25 });
  if (!ok) return { ok: false, signature: "" };

  // Classify new arrivals so priority badges are ready when the view refreshes
  // (cached per message, so already-seen mail costs nothing).
  await classifyMessages(userId, messages).catch(() => {});

  const unread = messages.filter((m) => m.unread).length;
  const top = messages[0]?.id ?? "";
  const signature = `${top}:${messages.length}:${unread}`;
  return { ok: true, signature };
}
