/**
 * Probe the Corsair MCP connection for the first connected tenant, trying both
 * streamable-HTTP (SDK helper) and SSE (hand-built), printing the real error.
 *
 *   pnpm exec tsx --env-file=.env scripts/mcp-probe.mts
 */
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@corsair-dev/app";
import { createMCPClient } from "@ai-sdk/mcp";

// Inline copy of lib/ai/corsair-mcp.ts (that file has `import "server-only"`
// which can't load in a plain tsx script). Keep in sync when changing logic.
class CorsairHttpTransport {
  sessionId?: string;
  protocolVersion?: string;
  onmessage?: (m: unknown) => void;
  onerror?: (e: Error) => void;
  onclose?: () => void;
  constructor(private opts: { url: string; headers?: Record<string, string> }) {}
  async start() {}
  setProtocolVersion(v: string) {
    this.protocolVersion = v;
  }
  async send(message: { id?: string | number; method?: string }) {
    const headers: Record<string, string> = {
      ...(this.opts.headers ?? {}),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    if (this.protocolVersion) headers["mcp-protocol-version"] = this.protocolVersion;
    const res = await fetch(this.opts.url, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    if (res.status === 202) return;
    if (!res.ok) throw new Error(`POST ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (ct.includes("application/json")) {
      const data = JSON.parse(text);
      for (const m of Array.isArray(data) ? data : [data]) this.onmessage?.(m);
      return;
    }
    for (const frame of text.split(/\r?\n\r?\n/)) {
      const data = frame
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) {
        try {
          this.onmessage?.(JSON.parse(data));
        } catch {}
      }
    }
  }
  async close() {
    this.onclose?.();
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const user = await prisma.user.findFirst({
  where: { corsairTenantId: { not: null } },
  select: { email: true, corsairTenantId: true },
});
await prisma.$disconnect();

if (!user?.corsairTenantId) {
  console.log("No connected tenant. Connect Google first.");
  process.exit(0);
}
const tenantId = user.corsairTenantId;
console.log(`Tenant: ${user.email} (${tenantId})\n`);

const corsair = createClient({ apiKey: process.env.CORSAIR_DEV_KEY! });
const tenant = corsair.instance(process.env.CORSAIR_INSTANCE_ID!).tenant(tenantId);

const cfg = tenant.mcp.config();
console.log("MCP config url:", cfg.url, "\n");

// 1a. HTTP via the SDK helper (the broken path) — for comparison.
try {
  console.log("→ HTTP (SDK createVercelClient)…");
  const client = await tenant.mcp.createVercelClient();
  const tools = await client.tools();
  console.log("  OK. tools:", Object.keys(tools).length);
  await client.close?.();
} catch (err) {
  console.log("  FAILED:", err instanceof Error ? err.message : err);
}

// 3. Tenant-scoped MCP key (HTTP).
try {
  console.log("\n→ HTTP via tenant.mcpKeys.create (createMCPClient)…");
  const key = await tenant.mcpKeys.create("mcp-probe-temp");
  try {
    const client = await createMCPClient({
      transport: {
        type: "http",
        url: key.mcpHttpUrl,
        headers: { Authorization: `Bearer ${key.secret}` },
      },
    });
    const tools = await client.tools();
    console.log("  OK. tools:", Object.keys(tools).length);
    await client.close?.();
  } finally {
    await tenant.mcpKeys.revoke(key.id);
  }
} catch (err) {
  console.log("  FAILED:", err instanceof Error ? err.message : err);
}

// 1b. HTTP via our custom POST-only transport, run 5× to check reliability.
const u = new URL(cfg.url);
if (!u.searchParams.has("tenantId")) u.searchParams.set("tenantId", tenantId);
const customHeaders = {
  "X-Corsair-Tenant-Id": tenantId,
  ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
};
for (let i = 1; i <= 5; i++) {
  try {
    const client = await createMCPClient({
      transport: new CorsairHttpTransport({ url: u.toString(), headers: customHeaders }) as never,
    });
    const tools = await client.tools();
    let exec = "";
    if (i === 1) {
      const tool = (tools as unknown as Record<string, { execute?: (a: unknown, o: unknown) => Promise<unknown> }>)
        .list_operations;
      const out = await tool?.execute?.({ type: "api" }, {});
      exec = ` | list_operations executed: ${out ? "OK" : "no-op"}`;
    }
    console.log(`→ HTTP (CorsairHttpTransport) run ${i}: OK, ${Object.keys(tools).length} tools${exec}`);
    await client.close?.();
  } catch (err) {
    console.log(`→ HTTP (CorsairHttpTransport) run ${i}: FAILED:`, err instanceof Error ? err.message : err);
  }
}

// 2. SSE hand-built.
try {
  console.log("\n→ SSE (createMCPClient)…");
  const url = new URL(cfg.url);
  if (!url.searchParams.has("tenantId")) url.searchParams.set("tenantId", tenantId);
  const client = await createMCPClient({
    transport: {
      type: "sse",
      url: url.toString(),
      headers: {
        "X-Corsair-Tenant-Id": tenantId,
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
    },
  });
  const tools = await client.tools();
  console.log("  OK. tools:", Object.keys(tools).length);
  await client.close?.();
} catch (err) {
  console.log("  FAILED:", err instanceof Error ? err.message : err);
}
