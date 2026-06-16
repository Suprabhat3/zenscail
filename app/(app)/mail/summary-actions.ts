"use server";

import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getEmailSummaryFor, type EmailSummaryData } from "@/lib/ai/summary";

/**
 * Fetch (or lazily generate + cache) the one-glance summary for an inbox
 * message. Backs the hover card. Best-effort: returns null on any failure so
 * the inbox never breaks. Summaries are generated at most once per email —
 * proactively on arrival (webhook) and here as the fallback for older mail.
 */
export async function getEmailSummary(messageId: string): Promise<EmailSummaryData | null> {
  if (!messageId) return null;
  try {
    const session = await requireSession();
    const tenantId = await ensureCorsairTenant(session.user.id);
    const t = corsairTenant(tenantId);
    return await getEmailSummaryFor(session.user.id, t, messageId);
  } catch {
    return null;
  }
}
