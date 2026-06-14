"use client";

import { useEffect, useState } from "react";
import { SMART_COMPOSE_KEY } from "@/components/mail/SmartComposeTextarea";
import { useToast } from "@/components/ui/Toast";

export function SmartComposeSetting() {
  const { toast } = useToast();
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOn(window.localStorage.getItem(SMART_COMPOSE_KEY) === "on");
    setReady(true);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    window.localStorage.setItem(SMART_COMPOSE_KEY, next ? "on" : "off");
    toast(next ? "Smart compose on" : "Smart compose off");
  }

  return (
    <div className="rounded-2xl border border-(--line-soft) bg-(--paper) p-6 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg text-(--ink)">Smart compose</h2>
          <p className="mt-1 max-w-md text-sm text-(--muted)">
            As you write a new message, suggest a short continuation in gray —
            press <kbd className="rounded border border-(--line) bg-(--bg) px-1">Tab</kbd> to
            accept. Off by default. Stored on this device.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ready && on}
          onClick={toggle}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
            ready && on ? "bg-(--accent)" : "bg-(--line)"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-(--paper) shadow transition-transform ${
              ready && on ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
