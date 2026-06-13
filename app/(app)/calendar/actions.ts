"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { randomUUID } from "node:crypto";
import {
  refreshEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type EventInput,
  type EventReminder,
  type GcalEventTime,
} from "@/lib/gcal";

const RECURRENCE_RULES: Record<string, string> = {
  DAILY: "RRULE:FREQ=DAILY",
  WEEKLY: "RRULE:FREQ=WEEKLY",
  MONTHLY: "RRULE:FREQ=MONTHLY",
  YEARLY: "RRULE:FREQ=YEARLY",
  WEEKDAYS: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
};

async function tenantForCurrentUser() {
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  return corsairTenant(tenantId);
}

export async function refreshCalendar() {
  const t = await tenantForCurrentUser();
  const now = new Date();
  const result = await refreshEvents(t, {
    timeMin: new Date(now.getTime() - 30 * 86400_000),
    timeMax: new Date(now.getTime() + 90 * 86400_000),
  });
  if (!result.success) redirect("/connect");
  revalidatePath("/calendar");
}

function eventFromForm(formData: FormData): EventInput {
  const summary = String(formData.get("summary") ?? "").trim();
  const date = String(formData.get("date") ?? ""); // YYYY-MM-DD
  const startTime = String(formData.get("startTime") ?? ""); // HH:mm, empty = all-day
  const endTime = String(formData.get("endTime") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const attendeesRaw = String(formData.get("attendees") ?? "");
  const timeZone = String(formData.get("timeZone") ?? "") || undefined;
  const allDay = formData.get("allDay") === "on";
  const recurrence = String(formData.get("recurrence") ?? "none");
  const visibility = String(formData.get("visibility") ?? "default");
  const availability = String(formData.get("availability") ?? "opaque");
  const colorId = String(formData.get("colorId") ?? "").trim();
  const addMeet = formData.get("addMeet") === "on";
  const hasExistingMeet = formData.get("hasMeet") === "yes";
  const useDefaultReminders = formData.get("useDefaultReminders") === "on";
  const guestsCanInviteOthers = formData.get("guestsCanInviteOthers") === "on";
  const guestsCanModify = formData.get("guestsCanModify") === "on";
  const guestsCanSeeOtherGuests = formData.get("guestsCanSeeOtherGuests") === "on";

  if (!summary || !date) throw new Error("Title and date are required");

  // Custom reminder rows (parallel method/minutes arrays from the form).
  const methods = formData.getAll("reminderMethod").map((v) => String(v));
  const minutes = formData.getAll("reminderMinutes").map((v) => String(v));
  const overrides: EventReminder[] = [];
  for (let i = 0; i < minutes.length; i++) {
    const m = Number(minutes[i]);
    if (!Number.isFinite(m) || m < 0) continue;
    const method = methods[i] === "email" ? "email" : "popup";
    overrides.push({ method, minutes: m });
  }

  let start: GcalEventTime;
  let end: GcalEventTime;
  if (startTime && !allDay) {
    start = { dateTime: `${date}T${startTime}:00`, timeZone };
    // Default to one hour when no end time given.
    end = endTime
      ? { dateTime: `${date}T${endTime}:00`, timeZone }
      : {
          dateTime: new Date(
            new Date(`${date}T${startTime}:00`).getTime() + 3600_000,
          )
            .toISOString()
            .slice(0, 19),
          timeZone,
        };
  } else {
    // All-day: Google wants an exclusive end date.
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    start = { date };
    end = { date: next.toISOString().slice(0, 10) };
  }

  const attendees = attendeesRaw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"))
    .map((email) => ({ email }));

  // Reminders: explicit override list wins; otherwise fall back to the
  // calendar default if the user kept that checked.
  const reminders =
    overrides.length > 0
      ? { useDefault: false, overrides }
      : { useDefault: useDefaultReminders };

  return {
    summary,
    start,
    end,
    ...(description ? { description } : {}),
    ...(location ? { location } : {}),
    ...(attendees.length ? { attendees } : {}),
    ...(recurrence !== "none" && RECURRENCE_RULES[recurrence]
      ? { recurrence: [RECURRENCE_RULES[recurrence]] }
      : {}),
    ...(visibility !== "default" ? { visibility: visibility as EventInput["visibility"] } : {}),
    ...(availability === "transparent" ? { transparency: "transparent" as const } : {}),
    ...(colorId ? { colorId } : {}),
    reminders,
    guestsCanInviteOthers,
    guestsCanModify,
    guestsCanSeeOtherGuests,
    // Request a Meet link when newly asked for (skip if one already exists).
    ...(addMeet && !hasExistingMeet
      ? {
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" as const },
            },
          },
        }
      : {}),
  };
}

export async function createEventAction(formData: FormData) {
  const t = await tenantForCurrentUser();
  const result = await createEvent(t, eventFromForm(formData));
  if (!result.success) redirect("/connect");
  // Pull the new event into the cache so it shows up immediately.
  await refreshEvents(t);
  revalidatePath("/calendar");
  redirect("/calendar");
}

export async function updateEventAction(formData: FormData) {
  const t = await tenantForCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing event id");
  const result = await updateEvent(t, id, eventFromForm(formData));
  if (!result.success) redirect("/connect");
  await refreshEvents(t);
  revalidatePath("/calendar");
  redirect("/calendar");
}

export async function deleteEventAction(formData: FormData) {
  const t = await tenantForCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const result = await deleteEvent(t, id);
  if (!result.success) redirect("/connect");
  await refreshEvents(t);
  revalidatePath("/calendar");
  redirect("/calendar");
}
