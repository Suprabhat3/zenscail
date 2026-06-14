"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { createBookingLink } from "@/app/(app)/calendar/links/actions";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

const field =
  "mt-1.5 w-full rounded-xl border border-(--line) bg-(--bg) px-3.5 py-2.5 text-sm text-(--ink) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)";
const labelCls = "block text-xs font-semibold text-(--muted)";

export function BookingLinkForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [tz, setTz] = useState("UTC");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTz("UTC");
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const data = new FormData(e.currentTarget);
      const { slug } = await createBookingLink(data);
      const url = `${window.location.origin}/book/${slug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("Link created and copied to clipboard");
      } catch {
        toast("Booking link created");
      }
      formRef.current?.reset();
      router.refresh();
    } catch {
      toast("Couldn't create the link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-3xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)"
    >
      <input type="hidden" name="timezone" value={tz} />
      <label className={labelCls}>
        Title
        <input name="title" defaultValue="Intro call" required className={field} />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Duration
          <select name="durationMins" defaultValue="30" className={field}>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </select>
        </label>
        <label className={labelCls}>
          Bookable up to
          <select name="windowDays" defaultValue="14" className={field}>
            <option value="7">1 week out</option>
            <option value="14">2 weeks out</option>
            <option value="30">30 days out</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Available from
          <select name="hoursStart" defaultValue="9" className={field}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Available until
          <select name="hoursEnd" defaultValue="17" className={field}>
            {HOURS.slice(1).concat(24).map((h) => (
              <option key={h} value={h}>
                {h === 24 ? "12 AM" : hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-(--muted)">
        Times shown to bookers in <span className="font-medium text-(--ink-soft)">{tz}</span>.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create booking link"}
      </button>
    </form>
  );
}
