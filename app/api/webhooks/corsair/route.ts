import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsairTenant } from "@/lib/corsair";
import { verifyWebhookToken } from "@/lib/webhooks";
import { publish, type RealtimeEvent } from "@/lib/realtime";
import { listInboxMessages } from "@/lib/gmail";
import { classifyMessages } from "@/lib/ai/classify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Plugin = "gmail" | "googlecalendar";

/**
 * Inbound Corsair webhook receiver. One endpoint for all tenants and plugins
 * (Corsair's recommended single-endpoint model); the tenant is identified by
 * the `tenantId` + `token` query params we baked into the registered URL (see
 * lib/webhooks.ts). On each event we log it, kick the priority classifier for
 * new mail, and push a realtime event so the open inbox/calendar re-fetches.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const token = url.searchParams.get("token");

  if (!tenantId || !verifyWebhookToken(tenantId, token)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // tenantId == our Corsair tenant id; map it back to the app user.
  const user = await prisma.user.findFirst({
    where: { corsairTenantId: tenantId },
    select: { id: true, connectedEmail: true },
  });
  if (!user) return new Response("Unknown tenant", { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { plugin, type } = classifyEvent(body);

  // Persist the raw event (best-effort; never block the 200 on a DB hiccup).
  try {
    await prisma.inboxEvent.create({
      data: {
        userId: user.id,
        plugin,
        type,
        payload: body as object,
      },
    });
  } catch (err) {
    console.error("webhook: failed to log event", err);
  }

  // Push to open browsers immediately — they re-fetch the feed (which lists
  // new mail straight from Gmail), so the inbox updates without waiting on us.
  const event: RealtimeEvent = { plugin, type, at: Date.now() };
  publish(user.id, event);

  // Gmail webhook payloads carry the connected mailbox address — record it as
  // the user's identity (it may differ from their app-login email). Cheap, no
  // API call; best-effort so it never blocks the ack.
  if (plugin === "gmail") {
    const addr = extractEmailAddress(body);
    if (addr && user.connectedEmail?.toLowerCase() !== addr) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { connectedEmail: addr },
        });
      } catch (err) {
        console.error("webhook: failed to record connected email", err);
      }
    }
  }

  // New mail → run the priority classifier (Phase 7's realtime trigger). This
  // is slow (lists + LLM calls), so do it AFTER the 200 so we ack fast and
  // Corsair never times out / retries. Best-effort; badges appear next render.
  if (plugin === "gmail" && isNewMail(type)) {
    after(async () => {
      try {
        const t = corsairTenant(tenantId);
        const { ok, messages } = await listInboxMessages(t, { limit: 25 });
        if (ok) await classifyMessages(user.id, messages);
      } catch (err) {
        console.error("webhook: classify-on-arrival failed", err);
      }
    });
  }

  return Response.json({ ok: true });
}

/** Pull `emailAddress` out of a Gmail webhook payload (top-level or nested). */
function extractEmailAddress(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const nested = (b.message ?? b.event ?? b.data) as
    | Record<string, unknown>
    | undefined;
  const raw = b.emailAddress ?? nested?.emailAddress;
  if (typeof raw !== "string") return null;
  const addr = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? addr : null;
}

/** Best-effort plugin/type extraction — payload shapes vary by provider. */
function classifyEvent(body: unknown): { plugin: Plugin; type: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw =
    str(b.plugin) ||
    str(b.integration) ||
    str((b.event as Record<string, unknown> | undefined)?.plugin) ||
    "";
  const plugin: Plugin = raw.toLowerCase().includes("calendar") ? "googlecalendar" : "gmail";
  const type =
    str(b.type) ||
    str(b.action) ||
    str(b.event) ||
    Object.keys((b.event as object) ?? {})[0] ||
    "changed";
  return { plugin, type };
}

function isNewMail(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("received") || t.includes("message") || t === "changed";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
