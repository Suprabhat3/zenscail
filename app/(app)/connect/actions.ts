"use server";

import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";

/** Create a Corsair OAuth link for the client to open in a new tab. */
export async function createConnectLink(): Promise<{ url: string }> {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);

  const link = await corsairTenant(tenantId).connectLink.create({
    plugins: ["gmail", "googlecalendar"],
    ttlMs: 30 * 60 * 1000,
  });

  return { url: link.url };
}
