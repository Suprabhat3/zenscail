"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import {
  refreshEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type EventInput,
  type GcalEventTime,
} from "@/lib/gcal";

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

  if (!summary || !date) throw new Error("Title and date are required");

  let start: GcalEventTime;
  let end: GcalEventTime;
  if (startTime) {
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

  return {
    summary,
    start,
    end,
    ...(description ? { description } : {}),
    ...(location ? { location } : {}),
    ...(attendees.length ? { attendees } : {}),
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
