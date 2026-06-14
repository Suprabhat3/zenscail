"use client";

import { useEffect, useState } from "react";
import { UNDO_SECS_KEY } from "@/components/mail/SendBar";
import { useToast } from "@/components/ui/Toast";

const OPTIONS = [0, 5, 10, 30];

export function UndoWindowSetting() {
  const { toast } = useToast();
  const [value, setValue] = useState<number>(5);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(UNDO_SECS_KEY);
    const n = raw == null ? 5 : Number(raw);
    setValue(Number.isFinite(n) && OPTIONS.includes(n) ? n : 5);
    setReady(true);
  }, []);

  function choose(secs: number) {
    setValue(secs);
    window.localStorage.setItem(UNDO_SECS_KEY, String(secs));
    toast(secs === 0 ? "Undo Send turned off" : `Undo window set to ${secs}s`);
  }

  return (
    <div className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
      <h2 className="font-serif text-lg text-(--ink)">Undo Send</h2>
      <p className="mt-1 text-sm text-(--muted)">
        After you hit Send, hold the message for this many seconds so you can take
        it back. Stored on this device.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OPTIONS.map((secs) => {
          const active = ready && value === secs;
          return (
            <button
              key={secs}
              type="button"
              onClick={() => choose(secs)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-(--accent) bg-(--accent-soft) text-(--accent-deep)"
                  : "border-(--line) text-(--ink-soft) hover:border-(--ink) hover:text-(--ink)"
              }`}
            >
              {secs === 0 ? "Off" : `${secs} seconds`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
