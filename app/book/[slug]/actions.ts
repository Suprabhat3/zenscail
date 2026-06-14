"use server";

import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { createEvent } from "@/lib/gcal";
import { getBookingLink, slotIsFree } from "@/lib/booking";
import { publish } from "@/lib/realtime";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookResult =
  | { ok: true; whenIso: string; title: string }
  | { ok: false; error: string };

/**
 * Public booking endpoint (no auth). Re-checks the slot is still free, then
 * creates the event on the link owner's calendar with the booker as an
 * attendee so both sides get a real Google invite.
 */
export async function book(
  slug: string,
  slotIso: string,
  name: string,
  email: string,
): Promise<BookResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "Please enter a valid email." };

  const link = await getBookingLink(slug);
  if (!link) return { ok: false, error: "This booking link is no longer available." };

  const startMs = Date.parse(slotIso);
  if (Number.isNaN(startMs)) return { ok: false, error: "Invalid time slot." };

  // Re-check immediately before creating to avoid a double-book race.
  const free = await slotIsFree(link, slotIso);
  if (!free) return { ok: false, error: "Sorry — that slot was just taken. Please pick another." };

  const endMs = startMs + link.durationMins * 60_000;
  const tenantId = await ensureCorsairTenant(link.userId);
  const t = corsairTenant(tenantId);

  const result = await createEvent(t, {
    summary: `${link.title} with ${cleanName}`,
    description: `Booked via ZenScail scheduling link by ${cleanName} (${cleanEmail}).`,
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(endMs).toISOString() },
    attendees: [{ email: cleanEmail, displayName: cleanName }],
    reminders: { useDefault: true },
    guestsCanSeeOtherGuests: false,
  });
  if (!result.success) {
    return { ok: false, error: "Couldn't create the event. Please try again." };
  }

  // Nudge the owner's open calendar to refresh (best-effort, single-process).
  publish(link.userId, { plugin: "googlecalendar", type: "event.created", at: Date.now() });

  return { ok: true, whenIso: new Date(startMs).toISOString(), title: link.title };
}
