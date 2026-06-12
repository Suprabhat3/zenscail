import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import type { GcalEvent } from "@/lib/gcal";
import { EventForm } from "@/components/calendar/EventForm";
import { updateEventAction, deleteEventAction } from "../../actions";

export const metadata = { title: "Edit event — ZenScail" };

const responseLabel: Record<string, string> = {
  accepted: "accepted",
  declined: "declined",
  tentative: "maybe",
  needsAction: "no reply",
};

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);

  const result = await t.run<GcalEvent>("googlecalendar.api.events.get", { id });
  if (!result.success) notFound();
  const event = result.data;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/calendar" className="text-sm text-neutral-400 hover:text-neutral-200">
        ← Back to calendar
      </Link>
      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl">Edit event</h1>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-neutral-400 underline hover:text-neutral-200"
          >
            Open in Google Calendar
          </a>
        )}
      </div>

      {(event.attendees?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
          <span className="text-neutral-400">Attendees: </span>
          <span className="text-neutral-300">
            {event.attendees!
              .map(
                (a) =>
                  `${a.displayName || a.email}${
                    a.responseStatus ? ` (${responseLabel[a.responseStatus] ?? a.responseStatus})` : ""
                  }`,
              )
              .join(", ")}
          </span>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <EventForm action={updateEventAction} event={event} submitLabel="Save changes" />
      </div>

      <form action={deleteEventAction} className="mt-6">
        <input type="hidden" name="id" value={event.id ?? id} />
        <button className="rounded-lg border border-red-900/60 px-4 py-2 text-sm text-red-400 hover:bg-red-950/40">
          Delete event
        </button>
      </form>
    </div>
  );
}
