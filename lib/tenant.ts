import "server-only";

import { CorsairApiError } from "@corsair-dev/app";
import { prisma } from "@/lib/prisma";
import { corsairInstance } from "@/lib/corsair";

/**
 * Make sure the user has a Corsair tenant (tenant id = our user id) and
 * return its id. Called lazily from anywhere that needs Corsair access, so
 * users created before provisioning still get a tenant on first use.
 */
export async function ensureCorsairTenant(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.corsairTenantId) return user.corsairTenantId;

  let tenantId = userId;
  try {
    const tenant = await corsairInstance().tenants.create(userId);
    tenantId = tenant.id;
  } catch (err) {
    // Tenant may already exist on Corsair (e.g. our DB update failed last time).
    if (!(err instanceof CorsairApiError && err.code === "tenant_already_exists")) {
      throw err;
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { corsairTenantId: tenantId },
  });
  return tenantId;
}
