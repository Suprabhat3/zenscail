"use server";

import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { syncCalendarWindow } from "@/lib/gcal";
import { getCachedEventsInRange } from "@/lib/calendarCache";

const SIGNATURE_WINDOW_MS = 24 * 3600_000;

/**
 * Lightweight calendar freshness poll, called by the client poll (~every 60s)
 * while the user is on a calendar page — mirrors mail's pollInbox. Re-syncs the
 * cached window (warms CachedEvent), then returns a compact signature over the
 * next 24h of events so the client only router.refresh()es when something
 * actually changed.
 */
export async function pollCalendar(): Promise<{ ok: boolean; signature: string }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, signature: "" };
  }
  const userId = session.user.id;
  const tenantId = await ensureCorsairTenant(userId);
  const t = corsairTenant(tenantId);

  const ok = await syncCalendarWindow(t, userId);
  if (!ok) return { ok: false, signature: "" };

  const now = Date.now();
  const events = await getCachedEventsInRange(userId, now, now + SIGNATURE_WINDOW_MS);
  const signature = `${events.length}:${events.map((e) => e.id).join(",")}`;
  return { ok: true, signature };
}
