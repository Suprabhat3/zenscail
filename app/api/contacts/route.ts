import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { listInboxMessages } from "@/lib/gmail";
import { parseSender } from "@/components/mail/SenderAvatar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type Contact = { name: string; email: string };

/**
 * Recent unique correspondents, newest first — backs the recipient
 * autocomplete on the compose form (Gmail-style "type a word, suggest people
 * you've talked to"). Derived from inbox senders; no separate contacts store.
 */
export async function GET() {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const { ok, messages } = await listInboxMessages(t, { limit: 100 });
  if (!ok) return Response.json({ contacts: [] });

  const seen = new Set<string>();
  const contacts: Contact[] = [];
  for (const m of messages) {
    const { name, email } = parseSender(m.from || "");
    const key = email.toLowerCase();
    if (!email || !key.includes("@") || seen.has(key)) continue;
    seen.add(key);
    contacts.push({ name: name === email ? "" : name, email });
  }

  return Response.json(
    { contacts },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
