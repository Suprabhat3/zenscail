import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getAvailability } from "@/lib/gcal";
import { EventForm } from "@/components/calendar/EventForm";
import { createEventAction } from "../actions";

export const metadata = { title: "New event — ZenScail" };

function formatTime(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; summary?: string; description?: string }>;
}) {
  const { date, summary, description } = await searchParams;
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  // Availability helper: when a day is pre-selected, show busy slots for it.
  let busy: { start?: string; end?: string }[] = [];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 86400_000);
    busy = await getAvailability(t, dayStart, dayEnd);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/calendar" className="text-sm text-neutral-400 hover:text-neutral-200">
        ← Back to calendar
      </Link>
      <h1 className="mt-3 font-serif text-2xl">New event</h1>

      {date && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
          <span className="text-neutral-400">Busy on {date}: </span>
          {busy.length === 0 ? (
            <span className="text-neutral-300">all clear</span>
          ) : (
            <span className="text-neutral-300">
              {busy.map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`).join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <EventForm
          action={createEventAction}
          defaults={{ date, summary, description }}
          submitLabel="Create event"
        />
      </div>
    </div>
  );
}
