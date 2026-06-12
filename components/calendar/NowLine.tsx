"use client";

import { useEffect, useState } from "react";

/**
 * Red current-time line for today's column in the week grid.
 * Positions itself within the [startHour, endHour) window; hidden outside it.
 */
export function NowLine({
  startHour,
  endHour,
  pxPerHour,
}: {
  startHour: number;
  endHour: number;
  pxPerHour: number;
}) {
  const [now, setNow] = useState<Date | null>(null);

  // First tick is deferred (not sync in the effect) — also keeps SSR/client
  // markup identical until hydration is done.
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (!now) return null;
  const hours = now.getHours() + now.getMinutes() / 60;
  if (hours < startHour || hours >= endHour) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 left-0 z-20"
      style={{ top: (hours - startHour) * pxPerHour }}
    >
      <div className="relative h-px bg-(--accent)">
        <span className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rounded-full bg-(--accent)" />
      </div>
    </div>
  );
}
