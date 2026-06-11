"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";

export async function createConnectLink() {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);

  const link = await corsairTenant(tenantId).connectLink.create({
    plugins: ["gmail", "googlecalendar"],
    ttlMs: 30 * 60 * 1000,
  });

  redirect(link.url);
}
