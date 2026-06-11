/** Quick health check: instance status, plugins, runtime. */
import { createClient } from "@corsair-dev/app";

const corsair = createClient({ apiKey: process.env.CORSAIR_DEV_KEY! });
const inst = corsair.instance(process.env.CORSAIR_INSTANCE_ID!);

const detail = await inst.get();
console.log(`Instance ${detail.name}: ${detail.status}`);
for (const p of detail.plugins) {
  console.log(`  plugin ${p.id}: mode=${p.mode} authType=${p.authType} useManaged=${p.useManaged}`);
}
const runtime = await inst.runtime.status();
console.log(`Runtime warm=${runtime.warm} dbOk=${runtime.dbOk}`);
