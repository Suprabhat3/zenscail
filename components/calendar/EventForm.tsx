"use client";

import { useState } from "react";
import { TimeZoneField } from "./TimeZoneField";
import { RecipientField } from "@/components/mail/RecipientField";
import type { EventReminder, GcalEvent } from "@/lib/gcal";

const inputClass =
  "w-full rounded-2xl border border-(--line) bg-(--bg) px-3.5 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) transition focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)";
const labelClass = "block text-sm font-medium text-(--ink-soft)";
const selectClass = `${inputClass} cursor-pointer`;

// Google Calendar's standard event palette (colorId → name + hex).
const EVENT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: "", name: "Default", hex: "#E11D48" },
  { id: "1", name: "Lavender", hex: "#7986cb" },
  { id: "2", name: "Sage", hex: "#33b679" },
  { id: "3", name: "Grape", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", hex: "#e67c73" },
  { id: "5", name: "Banana", hex: "#f6bf26" },
  { id: "6", name: "Tangerine", hex: "#f4511e" },
  { id: "7", name: "Peacock", hex: "#039be5" },
  { id: "8", name: "Graphite", hex: "#616161" },
  { id: "9", name: "Blueberry", hex: "#3f51b5" },
  { id: "10", name: "Basil", hex: "#0b8043" },
  { id: "11", name: "Tomato", hex: "#d50000" },
];

const REMINDER_PRESETS = [
  { minutes: 0, label: "At start time" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 10080, label: "1 week before" },
];

function timePart(dateTime?: string): string {
  if (!dateTime) return "";
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function datePart(t?: { date?: string; dateTime?: string }): string {
  if (t?.date) return t.date;
  if (!t?.dateTime) return "";
  const d = new Date(t.dateTime);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function recurrenceValue(recurrence?: string[]): string {
  const rule = recurrence?.find((r) => r.startsWith("RRULE"));
  if (!rule) return "none";
  if (/BYDAY=MO,TU,WE,TH,FR/.test(rule)) return "WEEKDAYS";
  const m = rule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
  return m ? m[1] : "none";
}

export function EventForm({
  action,
  event,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  event?: GcalEvent;
  defaults?: {
    date?: string;
    summary?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    attendees?: string;
  };
  submitLabel: string;
}) {
  const attendees = event
    ? (event.attendees ?? [])
        .filter((a) => !a.self)
        .map((a) => a.email)
        .filter(Boolean)
        .join(", ")
    : (defaults?.attendees ?? "");

  const [allDay, setAllDay] = useState(
    Boolean(event?.start?.date && !event?.start?.dateTime),
  );
  const hasMeet = Boolean(event?.hangoutLink);
  const [reminders, setReminders] = useState<EventReminder[]>(
    event?.reminders?.overrides ?? [],
  );

  function addReminder() {
    setReminders((prev) => [...prev, { method: "popup", minutes: 10 }]);
  }
  function removeReminder(i: number) {
    setReminders((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateReminder(i: number, patch: Partial<EventReminder>) {
    setReminders((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }

  return (
    <form action={action} className="space-y-5">
      <TimeZoneField />
      {event?.id && <input type="hidden" name="id" value={event.id} />}
      {hasMeet && <input type="hidden" name="hasMeet" value="yes" />}

      {/* Title */}
      <label className={labelClass}>
        Title
        <input
          type="text"
          name="summary"
          required
          defaultValue={event?.summary ?? defaults?.summary ?? ""}
          placeholder="Add a title"
          className={`${inputClass} mt-1.5`}
        />
      </label>

      {/* When */}
      <div className="rounded-2xl border border-(--line-soft) bg-(--bg)/50 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-(--ink)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            When
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-(--ink-soft)">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 accent-(--accent)"
            />
            All day
          </label>
        </div>

        <div className={`mt-3 grid grid-cols-1 gap-3 ${allDay ? "" : "sm:grid-cols-3"}`}>
          <label className={labelClass}>
            Date
            <input
              type="date"
              name="date"
              required
              defaultValue={datePart(event?.start) || defaults?.date || ""}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          {!allDay && (
            <>
              <label className={labelClass}>
                Start
                <input
                  type="time"
                  name="startTime"
                  defaultValue={timePart(event?.start?.dateTime) || defaults?.startTime || ""}
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className={labelClass}>
                End
                <input
                  type="time"
                  name="endTime"
                  defaultValue={timePart(event?.end?.dateTime) || defaults?.endTime || ""}
                  className={`${inputClass} mt-1.5`}
                />
              </label>
            </>
          )}
        </div>

        {/* Recurrence */}
        <label className={`${labelClass} mt-3`}>
          Repeat
          <select
            name="recurrence"
            defaultValue={recurrenceValue(event?.recurrence)}
            className={`${selectClass} mt-1.5`}
          >
            <option value="none">Does not repeat</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="WEEKDAYS">Every weekday (Mon–Fri)</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>
        {!allDay && (
          <p className="mt-2.5 text-xs text-(--muted)">
            Leave start and end empty for an event with no set time. End defaults to one hour after start.
          </p>
        )}
      </div>

      {/* Guests */}
      <div className={labelClass}>
        Guests
        <div className="mt-1.5">
          <RecipientField
            name="attendees"
            defaultValue={attendees}
            placeholder="Add guests by name or email…"
          />
        </div>
        <div className="mt-2.5 space-y-1.5 rounded-2xl border border-(--line-soft) bg-(--bg)/50 px-4 py-3 text-sm text-(--ink-soft)">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
            Guests can
          </p>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="guestsCanInviteOthers" defaultChecked={event?.guestsCanInviteOthers ?? true} className="h-4 w-4 accent-(--accent)" />
            Invite others
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="guestsCanSeeOtherGuests" defaultChecked={event?.guestsCanSeeOtherGuests ?? true} className="h-4 w-4 accent-(--accent)" />
            See guest list
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="guestsCanModify" defaultChecked={event?.guestsCanModify ?? false} className="h-4 w-4 accent-(--accent)" />
            Modify event
          </label>
        </div>
        <span className="mt-1.5 block text-xs text-(--muted)">
          Guests receive a calendar invite by email.
        </span>
      </div>

      {/* Video conferencing */}
      <div className={labelClass}>
        Video conferencing
        {hasMeet ? (
          <a
            href={event?.hangoutLink}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 flex items-center gap-2 rounded-2xl border border-(--line) bg-(--bg) px-3.5 py-2.5 text-sm text-(--accent) underline"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m23 7-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            Join Google Meet
          </a>
        ) : (
          <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-2xl border border-(--line) bg-(--bg) px-3.5 py-2.5 text-sm text-(--ink-soft)">
            <input type="checkbox" name="addMeet" className="h-4 w-4 accent-(--accent)" />
            Add Google Meet video conferencing
          </label>
        )}
      </div>

      {/* Location */}
      <label className={labelClass}>
        Location
        <input
          type="text"
          name="location"
          defaultValue={event?.location ?? ""}
          placeholder="Add a place or meeting link"
          className={`${inputClass} mt-1.5`}
        />
      </label>

      {/* Notifications */}
      <div className={labelClass}>
        Notifications
        <div className="mt-1.5 space-y-2">
          {reminders.length === 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-(--ink-soft)">
              <input
                type="checkbox"
                name="useDefaultReminders"
                defaultChecked={event ? (event.reminders?.useDefault ?? true) : true}
                className="h-4 w-4 accent-(--accent)"
              />
              Use the calendar&rsquo;s default notification
            </label>
          )}
          {reminders.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                name="reminderMethod"
                value={r.method}
                onChange={(e) => updateReminder(i, { method: e.target.value as EventReminder["method"] })}
                className={`${selectClass} max-w-28`}
              >
                <option value="popup">Notification</option>
                <option value="email">Email</option>
              </select>
              <select
                name="reminderMinutes"
                value={r.minutes}
                onChange={(e) => updateReminder(i, { minutes: Number(e.target.value) })}
                className={selectClass}
              >
                {REMINDER_PRESETS.map((p) => (
                  <option key={p.minutes} value={p.minutes}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeReminder(i)}
                aria-label="Remove notification"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addReminder}
            className="flex items-center gap-1.5 text-sm font-medium text-(--accent) transition hover:text-(--accent-deep)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add a notification
          </button>
        </div>
      </div>

      {/* Color, visibility, availability */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Busy / Free
          <select
            name="availability"
            defaultValue={event?.transparency === "transparent" ? "transparent" : "opaque"}
            className={`${selectClass} mt-1.5`}
          >
            <option value="opaque">Busy</option>
            <option value="transparent">Free</option>
          </select>
        </label>
        <label className={labelClass}>
          Visibility
          <select
            name="visibility"
            defaultValue={event?.visibility ?? "default"}
            className={`${selectClass} mt-1.5`}
          >
            <option value="default">Calendar default</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
      </div>

      {/* Color picker */}
      <div className={labelClass}>
        Color
        <div className="mt-2 flex flex-wrap gap-2">
          {EVENT_COLORS.map((c) => (
            <label key={c.id || "default"} className="cursor-pointer">
              <input
                type="radio"
                name="colorId"
                value={c.id}
                defaultChecked={(event?.colorId ?? "") === c.id}
                className="peer sr-only"
              />
              <span
                title={c.name}
                style={{ backgroundColor: c.hex }}
                className="block h-7 w-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-(--paper) transition peer-checked:ring-(--ink) hover:scale-110"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Description */}
      <label className={labelClass}>
        Description
        <textarea
          name="description"
          rows={4}
          defaultValue={event?.description ?? defaults?.description ?? ""}
          placeholder="Add notes, agenda, or details"
          className={`${inputClass} mt-1.5 resize-none leading-relaxed`}
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
