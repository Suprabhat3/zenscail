"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import { putCachedEvents, dropCachedEvent } from "@/lib/calendarCache";
import { formCheckbox, parseFormData } from "@/lib/validation";

/** Scalar fields of the event form. Reminder rows (multi-value) are read
 *  separately via `formData.getAll`. */
const EventFormSchema = z.object({
  summary: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Title and date are required"),
  date: z.string().min(1, "Title and date are required"), // YYYY-MM-DD
  startTime: z.string().optional().transform((s) => s ?? ""), // HH:mm, empty = all-day
  endTime: z.string().optional().transform((s) => s ?? ""),
  description: z.string().optional().transform((s) => s?.trim() ?? ""),
  location: z.string().optional().transform((s) => s?.trim() ?? ""),
  attendees: z.string().optional().transform((s) => s ?? ""),
  timeZone: z.string().optional().transform((s) => s || undefined),
  allDay: formCheckbox("on"),
  recurrence: z.string().optional().transform((s) => s || "none"),
  visibility: z.string().optional().transform((s) => s || "default"),
  availability: z.string().optional().transform((s) => s || "opaque"),
  colorId: z.string().optional().transform((s) => s?.trim() ?? ""),
  addMeet: formCheckbox("on"),
  hasMeet: formCheckbox("yes"),
  useDefaultReminders: formCheckbox("on"),
  guestsCanInviteOthers: formCheckbox("on"),
  guestsCanModify: formCheckbox("on"),
  guestsCanSeeOtherGuests: formCheckbox("on"),
});

const EventIdSchema = z.object({ id: z.string().min(1, "Missing event id") });

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
  return { t: corsairTenant(tenantId), userId: session.user.id };
}

export async function refreshCalendar() {
  const { t } = await tenantForCurrentUser();
  const now = new Date();
  const result = await refreshEvents(t, {
    timeMin: new Date(now.getTime() - 30 * 86400_000),
    timeMax: new Date(now.getTime() + 90 * 86400_000),
  });
  if (!result.success) redirect("/connect");
  revalidatePath("/calendar");
}

function eventFromForm(formData: FormData): EventInput {
  const {
    summary,
    date,
    startTime,
    endTime,
    description,
    location,
    attendees: attendeesRaw,
    timeZone,
    allDay,
    recurrence,
    visibility,
    availability,
    colorId,
    addMeet,
    hasMeet: hasExistingMeet,
    useDefaultReminders,
    guestsCanInviteOthers,
    guestsCanModify,
    guestsCanSeeOtherGuests,
  } = parseFormData(formData, EventFormSchema);

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

/**
 * One-click "Meet now": creates a 30-minute calendar event starting now with a
 * Google Meet link attached, then drops the user on the event page where the
 * join link is shown. Unlike the AI assistant (review-first), this is a direct
 * user action, so it creates immediately.
 */
export async function createInstantMeet() {
  const { t, userId } = await tenantForCurrentUser();
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 60_000);
  const event: EventInput = {
    summary: "Instant meeting",
    start: { dateTime: now.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: true },
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  const result = await createEvent(t, event);
  if (!result.success) redirect("/connect");
  if (result.data) await putCachedEvents(userId, [result.data]);
  revalidatePath("/calendar");
  const id = result.data?.id;
  redirect(id ? `/calendar/event/${encodeURIComponent(id)}` : "/calendar");
}

export async function createEventAction(formData: FormData) {
  const { t, userId } = await tenantForCurrentUser();
  const result = await createEvent(t, eventFromForm(formData));
  if (!result.success) redirect("/connect");
  // Write the new event straight into the cache so it shows up immediately.
  if (result.data) await putCachedEvents(userId, [result.data]);
  revalidatePath("/calendar");
  redirect("/calendar");
}

export async function updateEventAction(formData: FormData) {
  const { t, userId } = await tenantForCurrentUser();
  const { id } = EventIdSchema.parse(Object.fromEntries(formData.entries()));
  const result = await updateEvent(t, id, eventFromForm(formData));
  if (!result.success) redirect("/connect");
  if (result.data) await putCachedEvents(userId, [result.data]);
  revalidatePath("/calendar");
  redirect("/calendar");
}

export async function deleteEventAction(formData: FormData) {
  const { t, userId } = await tenantForCurrentUser();
  const parsed = EventIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const result = await deleteEvent(t, parsed.data.id);
  if (!result.success) redirect("/connect");
  await dropCachedEvent(userId, parsed.data.id);
  revalidatePath("/calendar");
  redirect("/calendar");
}
