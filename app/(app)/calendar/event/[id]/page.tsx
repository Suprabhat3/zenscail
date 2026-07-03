import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import type { GcalEvent } from "@/lib/gcal";
import { getCachedEvent, putCachedEvents } from "@/lib/calendarCache";
import { EventForm } from "@/components/calendar/EventForm";
import { SubmitButton } from "@/components/app/SubmitButton";
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

  const cached = await getCachedEvent(session.user.id, id);
  let event: GcalEvent;
  if (cached) {
    event = cached;
  } else {
    const result = await t.run<GcalEvent>("googlecalendar.api.events.get", { id });
    if (!result.success) notFound();
    event = result.data;
    await putCachedEvents(session.user.id, [event]);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/calendar" className="text-sm text-(--muted) transition hover:text-(--ink)">
        ← Back to calendar
      </Link>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-normal tracking-tight text-(--ink)">
            Edit event
          </h1>
          <p className="mt-0.5 text-sm text-(--muted)">
            Changes sync to Google Calendar and notify your guests.
          </p>
        </div>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm text-(--accent) underline transition hover:text-(--accent-deep)"
          >
            Open in Google Calendar
          </a>
        )}
      </div>

      {(event.attendees?.length ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-3 text-sm shadow-(--shadow-card)">
          <span className="text-(--muted)">Responses: </span>
          <span className="text-(--ink-soft)">
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

      <div className="mt-6 rounded-3xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
        <EventForm action={updateEventAction} event={event} submitLabel="Save changes" />
      </div>

      <form action={deleteEventAction} className="mt-5">
        <input type="hidden" name="id" value={event.id ?? id} />
        <SubmitButton
          pendingLabel="Deleting…"
          className="flex items-center gap-1.5 rounded-full border border-(--accent)/40 px-4 py-2 text-sm font-medium text-(--accent) transition hover:bg-(--accent-soft)"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          }
        >
          Delete event
        </SubmitButton>
      </form>
    </div>
  );
}
