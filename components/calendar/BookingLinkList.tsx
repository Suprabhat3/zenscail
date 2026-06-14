"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  setBookingLinkActive,
  deleteBookingLink,
} from "@/app/(app)/calendar/links/actions";

export type LinkRow = {
  id: number;
  slug: string;
  title: string;
  durationMins: number;
  windowDays: number;
  hoursStart: number;
  hoursEnd: number;
  timezone: string;
  active: boolean;
};

export function BookingLinkList({ links }: { links: LinkRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  if (links.length === 0) {
    return (
      <div className="rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-16 text-center shadow-(--shadow-card)">
        <p className="font-serif text-lg text-(--ink)">No booking links yet</p>
        <p className="mt-1 text-sm text-(--muted)">
          Create one to share your availability — people pick a slot and it lands on your calendar.
        </p>
      </div>
    );
  }

  function copy(slug: string) {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast("Link copied"))
      .catch(() => toast(url));
  }

  return (
    <ul className="space-y-3">
      {links.map((l) => (
        <li
          key={l.id}
          className="overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) p-4 shadow-(--shadow-card) sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-(--ink)">
                {l.title}
                {!l.active && (
                  <span className="rounded-full bg-(--line-soft) px-2 py-0.5 text-[10px] font-medium text-(--muted)">
                    Off
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-(--muted)">
                {l.durationMins} min · {l.hoursStart}:00–{l.hoursEnd}:00 {l.timezone} · up to{" "}
                {l.windowDays} days out
              </p>
              <p className="mt-1 truncate font-mono text-xs text-(--accent-deep)">/book/{l.slug}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => copy(l.slug)}
                className="rounded-full bg-(--ink) px-3 py-1.5 text-xs font-semibold text-(--bg) transition hover:bg-(--accent)"
              >
                Copy link
              </button>
              <a
                href={`/book/${l.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
              >
                Preview
              </a>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await setBookingLinkActive(l.id, !l.active);
                    router.refresh();
                  })
                }
                className="rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
              >
                {l.active ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await deleteBookingLink(l.id);
                    toast("Link deleted");
                    router.refresh();
                  })
                }
                title="Delete"
                aria-label="Delete"
                className="rounded-full p-1.5 text-(--muted) transition hover:bg-(--accent)/10 hover:text-(--accent)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
