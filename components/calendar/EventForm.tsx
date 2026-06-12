import { TimeZoneField } from "./TimeZoneField";
import type { GcalEvent } from "@/lib/gcal";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none";

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

export function EventForm({
  action,
  event,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  event?: GcalEvent;
  defaults?: { date?: string; summary?: string; description?: string };
  submitLabel: string;
}) {
  const attendees = (event?.attendees ?? [])
    .filter((a) => !a.self)
    .map((a) => a.email)
    .filter(Boolean)
    .join(", ");

  return (
    <form action={action} className="space-y-4">
      <TimeZoneField />
      {event?.id && <input type="hidden" name="id" value={event.id} />}

      <label className="block text-sm text-neutral-300">
        Title
        <input
          type="text"
          name="summary"
          required
          defaultValue={event?.summary ?? defaults?.summary ?? ""}
          placeholder="Event title"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm text-neutral-300">
          Date
          <input
            type="date"
            name="date"
            required
            defaultValue={datePart(event?.start) || defaults?.date || ""}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-neutral-300">
          Start
          <input
            type="time"
            name="startTime"
            defaultValue={timePart(event?.start?.dateTime)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-neutral-300">
          End
          <input
            type="time"
            name="endTime"
            defaultValue={timePart(event?.end?.dateTime)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-xs text-neutral-500">
        Leave start and end empty for an all-day event. End defaults to one hour after start.
      </p>

      <label className="block text-sm text-neutral-300">
        Attendees
        <input
          type="text"
          name="attendees"
          defaultValue={attendees}
          placeholder="alice@example.com, bob@example.com"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Attendees receive a calendar invite by email.
        </span>
      </label>

      <label className="block text-sm text-neutral-300">
        Location
        <input
          type="text"
          name="location"
          defaultValue={event?.location ?? ""}
          placeholder="Optional"
          className={inputClass}
        />
      </label>

      <label className="block text-sm text-neutral-300">
        Description
        <textarea
          name="description"
          rows={4}
          defaultValue={event?.description ?? defaults?.description ?? ""}
          placeholder="Optional"
          className={inputClass}
        />
      </label>

      <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white">
        {submitLabel}
      </button>
    </form>
  );
}
