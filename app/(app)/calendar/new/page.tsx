import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getAvailability } from "@/lib/gcal";
import { EventForm } from "@/components/calendar/EventForm";
import { getUserTimeZone, formatInTZ, zonedToMs } from "@/lib/timezone";
import { createEventAction } from "../actions";

export const metadata = { title: "New event — ZenScail" };

function formatTime(value: string | undefined, tz: string): string {
  if (!value) return "";
  return formatInTZ(value, tz, { hour: "2-digit", minute: "2-digit" });
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    summary?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    attendees?: string;
    addMeet?: string;
  }>;
}) {
  const { date, summary, description, startTime, endTime, attendees, addMeet } =
    await searchParams;
  const session = await requireSession();
  const tz = await getUserTimeZone();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  // Availability helper: when a day is pre-selected, show busy slots for it.
  let busy: { start?: string; end?: string }[] = [];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    const dayStartMs = zonedToMs(y, m, d, 0, 0, tz);
    busy = await getAvailability(t, new Date(dayStartMs), new Date(dayStartMs + 86400_000));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/calendar" className="text-sm text-(--muted) transition hover:text-(--ink)">
        ← Back to calendar
      </Link>
      <h1 className="mt-3 font-serif text-3xl font-normal tracking-tight text-(--ink)">
        New event
      </h1>
      <p className="mt-0.5 text-sm text-(--muted)">
        Add it to your Google Calendar and notify your guests.
      </p>

      {date && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-3 text-sm shadow-(--shadow-card)">
          <svg className="mt-0.5 shrink-0 text-(--accent)" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>
            <span className="text-(--muted)">Busy on {date}: </span>
            {busy.length === 0 ? (
              <span className="font-medium text-(--ink)">all clear</span>
            ) : (
              <span className="text-(--ink-soft)">
                {busy.map((b) => `${formatTime(b.start, tz)}–${formatTime(b.end, tz)}`).join(", ")}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
        <EventForm
          action={createEventAction}
          defaults={{
            date,
            summary,
            description,
            startTime,
            endTime,
            attendees,
            addMeet: addMeet === "1",
          }}
          submitLabel="Create event"
        />
      </div>
    </div>
  );
}
