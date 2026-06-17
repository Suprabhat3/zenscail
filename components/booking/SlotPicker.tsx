"use client";

import { useState } from "react";
import { book, type BookResult } from "@/app/book/[slug]/actions";
import type { DaySlots } from "@/lib/booking";

export function SlotPicker({
  slug,
  title,
  durationMins,
  timezone,
  days,
}: {
  slug: string;
  title: string;
  durationMins: number;
  timezone: string;
  days: DaySlots[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ whenIso: string } | null>(null);

  if (done) {
    const when = new Date(done.whenIso).toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <div className="rounded-3xl border border-(--line-soft) bg-(--paper) p-8 text-center shadow-(--shadow-card)">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent-deep)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-4 font-serif text-2xl text-(--ink)">You&rsquo;re booked</h2>
        <p className="mt-1.5 text-sm text-(--ink-soft)">
          {title} · {when} ({timezone})
        </p>
        <p className="mt-3 text-sm text-(--muted)">
          A calendar invite is on its way to <span className="font-medium">{email}</span>.
        </p>
      </div>
    );
  }

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const res: BookResult = await book(slug, selected, name, email);
      if (res.ok) setDone({ whenIso: res.whenIso });
      else setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (days.length === 0) {
    return (
      <div className="rounded-3xl border border-(--line-soft) bg-(--paper) p-8 text-center shadow-(--shadow-card)">
        <p className="font-serif text-lg text-(--ink)">No open times right now</p>
        <p className="mt-1 text-sm text-(--muted)">Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
      <p className="text-[11.5px] font-bold tracking-widest text-(--accent) uppercase">
        Pick a time · {durationMins} min
      </p>
      <div className="mt-4 max-h-[22rem] space-y-5 overflow-y-auto pr-1">
        {days.map((d) => (
          <div key={d.date}>
            <p className="text-sm font-semibold text-(--ink)">{d.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {d.slots.map((s) => {
                const active = selected === s.iso;
                return (
                  <button
                    key={s.iso}
                    type="button"
                    onClick={() => {
                      setSelected(s.iso);
                      setError("");
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      active
                        ? "border-(--accent) bg-(--accent) text-(--bg)"
                        : "border-(--line) text-(--ink-soft) hover:border-(--ink) hover:text-(--ink)"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-6 border-t border-(--line-soft) pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-xl border border-(--line) bg-(--bg) px-3.5 py-2.5 text-sm text-(--ink) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="rounded-xl border border-(--line) bg-(--bg) px-3.5 py-2.5 text-sm text-(--ink) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
            />
          </div>
          {error && <p className="mt-3 text-sm text-(--accent)">{error}</p>}
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="mt-4 w-full rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
          >
            {busy ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      )}
    </div>
  );
}
