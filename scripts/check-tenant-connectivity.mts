// One-off: list users and probe whether their Corsair tenant has Google connected.
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@corsair-dev/app";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const corsair = createClient({ apiKey: process.env.CORSAIR_DEV_KEY! });
const inst = corsair.instance(process.env.CORSAIR_INSTANCE_ID!);

const users = await prisma.user.findMany({
  select: { id: true, email: true, corsairTenantId: true },
});
console.log(`${users.length} user(s)`);
for (const u of users) {
  if (!u.corsairTenantId) {
    console.log(`- ${u.email}: NO tenant`);
    continue;
  }
  const t = inst.tenant(u.corsairTenantId);
  const gmail = await t.run("gmail.api.labels.list");
  const gcal = await t.run("googlecalendar.api.events.getMany");
  console.log(
    `- ${u.email}: gmail=${gmail.success ? "CONNECTED" : "not connected"} gcal=${gcal.success ? "CONNECTED" : "not connected"}`,
  );
  if (gmail.success) {
    const msgs = await t.run("gmail.db.messages.search", { limit: 2 });
    console.log(`  sample db.messages.search:`, JSON.stringify(msgs).slice(0, 800));
  }
}
await prisma.$disconnect();
