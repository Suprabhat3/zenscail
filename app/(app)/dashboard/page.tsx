import Link from "next/link";
import { requireSession } from "@/lib/session";
import { sendActivatedOnce } from "@/lib/email/send";
import { getTodayBrief, type BriefEvent } from "@/lib/ai/brief";
import { Markdown } from "@/components/chat/Markdown";
import { GenerateBrief } from "@/components/dashboard/GenerateBrief";
import { BriefActionItems } from "@/components/dashboard/BriefActionItems";
import { NextUp } from "@/components/dashboard/NextUp";
import {
  AskBriefButton,
  RefreshBriefButton,
} from "@/components/dashboard/BriefChatButtons";
import { getUserTimeZone, formatInTZ, partsInTZ } from "@/lib/timezone";

export const metadata = { title: "Today — ZenScail" };
export const dynamic = "force-dynamic";

function greeting(tz: string): string {
  const h = partsInTZ(Date.now(), tz).hour;
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtTime(iso: string, tz: string): string {
  return formatInTZ(iso, tz, { hour: "numeric", minute: "2-digit" });
}

function TodayTimeline({ events, tz }: { events: BriefEvent[]; tz: string }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--line) px-4 py-8 text-center">
        <p className="text-sm text-(--muted)">No meetings today — a clear runway.</p>
      </div>
    );
  }
  return (
    <ol className="space-y-1">
      {events.map((e, i) => (
        <li key={e.id || i} className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-(--bg-deep)">
          <Link
            href={e.id ? `/calendar/event/${e.id}` : "/calendar"}
            className="flex min-w-0 flex-1 gap-3"
          >
            <span className="w-16 shrink-0 pt-0.5 text-xs font-bold text-(--accent)">
              {e.allDay ? "All day" : fmtTime(e.start, tz)}
            </span>
            <span className="w-1 shrink-0 self-stretch rounded-full bg-(--sage)" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-(--ink)">{e.summary}</span>
              <span className="block text-xs text-(--muted)">
                {!e.allDay && `until ${fmtTime(e.end, tz)}`}
                {e.location ? ` · ${e.location}` : ""}
                {e.attendeeCount > 1 ? ` · ${e.attendeeCount} people` : ""}
              </span>
            </span>
          </Link>
          {e.hangoutLink && (
            <a
              href={e.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Join video call"
              className="shrink-0 rounded-full border border-(--line) px-3 py-1 text-xs font-semibold text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
            >
              Join
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();

  // First time a fully-onboarded user reaches the dashboard, send the
  // "last email you'll read manually" finale. Guarded once-only and fired
  // without awaiting so it never delays the page render.
  void sendActivatedOnce({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  const tz = await getUserTimeZone();
  const brief = await getTodayBrief(session.user.id);
  const firstName = session.user.name?.split(" ")[0] || "there";
  const today = formatInTZ(new Date().getTime(), tz, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.14em] text-(--accent) uppercase">
            {today}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-(--ink) sm:text-4xl">
            {greeting(tz)}, {firstName}
          </h1>
          {brief && <p className="mt-2 max-w-2xl text-base text-(--ink-soft)">{brief.headline}</p>}
        </div>
        {brief && (
          <div className="flex items-center gap-2">
            <RefreshBriefButton />
            <AskBriefButton />
          </div>
        )}
      </div>

      {!brief ? (
        <div className="mt-8">
          <GenerateBrief />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                value: brief.stats.emailsReviewed,
                label: "emails reviewed",
                sub: "from the last 24 hours",
                href: "/mail",
              },
              {
                value: brief.actionItems.length,
                label: "things to do",
                sub: `${brief.actionItems.filter((a) => a.urgency === "high").length} urgent`,
                href: "#actions",
              },
              {
                value: brief.stats.meetingsToday,
                label: "meetings today",
                sub: brief.events[0]
                  ? `first at ${brief.events[0].allDay ? "—" : fmtTime(brief.events[0].start, tz)}`
                  : "calendar is clear",
                href: "/calendar",
              },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="group rounded-2xl border border-(--line-soft) bg-(--paper) px-5 py-4 shadow-(--shadow-card) transition hover:-translate-y-0.5 hover:border-(--line)"
              >
                <p className="font-serif text-3xl text-(--ink) group-hover:text-(--accent)">
                  {s.value}
                </p>
                <p className="text-sm font-semibold text-(--ink-soft)">{s.label}</p>
                <p className="mt-0.5 text-xs text-(--muted)">{s.sub}</p>
              </Link>
            ))}
          </div>

          {/* Main grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              {/* Overview */}
              <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
                <h2 className="flex items-center gap-2 text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
                  </svg>
                  Your morning brief
                </h2>
                <div className="mt-3 text-(--ink-soft)">
                  <Markdown>{brief.overview}</Markdown>
                </div>
              </section>

              {/* Action items */}
              <section id="actions" className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
                <h2 className="flex items-center gap-2 text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  What needs you today
                </h2>
                <BriefActionItems items={brief.actionItems} initialStates={brief.itemStates} />
              </section>
            </div>

            <div className="space-y-6">
              {/* Next up — live countdown + join */}
              <NextUp events={brief.events} />

              {/* Today's schedule */}
              <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
                <div className="flex items-baseline justify-between">
                  <h2 className="flex items-center gap-2 text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    Today&rsquo;s schedule
                  </h2>
                  <Link href="/calendar" className="text-xs font-semibold text-(--muted) hover:text-(--accent)">
                    Full calendar →
                  </Link>
                </div>
                <div className="mt-4">
                  <TodayTimeline events={brief.events} tz={tz} />
                </div>
              </section>

              {/* Quick actions */}
              <section className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
                <h2 className="text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
                  Quick actions
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { href: "/mail/compose", label: "Compose email" },
                    { href: "/calendar/new", label: "New event" },
                    { href: "/mail?q=is:unread", label: "Unread mail" },
                    { href: "/settings/ai", label: "AI settings" },
                  ].map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="rounded-xl border border-(--line-soft) bg-(--bg) px-3 py-2.5 text-center text-sm font-semibold text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
                    >
                      {a.label}
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-(--muted)">
                  Brief generated{" "}
                  {formatInTZ(brief.createdAt, tz, { hour: "numeric", minute: "2-digit" })}
                  .{" "}
                  {partsInTZ(new Date().getTime(), tz).hour >= 17
                    ? "Tomorrow’s brief lands at 9:00 — rest easy."
                    : "A fresh one arrives every morning at 9:00."}
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
