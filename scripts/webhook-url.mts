/**
 * Print the Corsair webhook delivery URL(s) to register.
 *
 * Corsair delivers webhooks to a URL you configure per instance/tenant in the
 * Corsair dashboard; this prints the authenticated URL for each connected
 * tenant (token = HMAC(tenantId, APP_SECRET), verified in lib/webhooks.ts).
 *
 *   pnpm exec tsx --env-file=.env scripts/webhook-url.mts
 *
 * In local dev, expose port 3000 with `ngrok http 3000` and set
 * PUBLIC_WEBHOOK_ORIGIN to the https tunnel URL before running this.
 */
import { createHmac } from "node:crypto";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const secret = process.env.APP_SECRET;
if (!secret) throw new Error("APP_SECRET is required");

const origin = (
  process.env.PUBLIC_WEBHOOK_ORIGIN ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

function token(tenantId: string): string {
  return createHmac("sha256", secret!).update(`webhook:${tenantId}`).digest("hex");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const users = await prisma.user.findMany({
  where: { corsairTenantId: { not: null } },
  select: { email: true, corsairTenantId: true },
});

if (users.length === 0) {
  console.log("No connected tenants yet. Sign in + connect Google first.");
} else {
  console.log(`Register these in the Corsair dashboard (origin: ${origin}):\n`);
  for (const u of users) {
    const tid = u.corsairTenantId!;
    const url = `${origin}/api/webhooks/corsair?tenantId=${encodeURIComponent(tid)}&token=${token(tid)}`;
    console.log(`  ${u.email}`);
    console.log(`    ${url}\n`);
  }
}

await prisma.$disconnect();
