"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateBriefAction } from "@/app/(app)/dashboard/actions";

const STAGES = [
  "Reading yesterday's emails…",
  "Checking today's calendar…",
  "Finding what needs your attention…",
  "Writing your brief…",
];

/**
 * Shown when today's brief doesn't exist yet (cron hasn't run for this user).
 * Kicks off generation immediately and refreshes the page when done.
 */
export function GenerateBrief() {
  const router = useRouter();
  const started = useRef(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      4000,
    );
    generateBriefAction()
      .then((res) => {
        if (res.ok) router.refresh();
        else setError(res.error ?? "Could not generate your brief.");
      })
      .catch(() => setError("Could not generate your brief."))
      .finally(() => clearInterval(ticker));
    return () => clearInterval(ticker);
  }, [router]);

  if (error) {
    const needsConnect = /not connected/i.test(error);
    return (
      <div className="rounded-2xl border border-(--line-soft) bg-(--paper) px-8 py-10 text-center shadow-(--shadow-card)">
        <p className="font-serif text-2xl text-(--ink)">Couldn&rsquo;t build your brief</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-(--muted)">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          {needsConnect ? (
            <Link
              href="/connect"
              className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
            >
              Connect Google
            </Link>
          ) : (
            <button
              onClick={() => {
                started.current = false;
                setError(null);
                setStage(0);
                router.refresh();
              }}
              className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent)"
            >
              Try again
            </button>
          )}
          <Link
            href="/settings/ai"
            className="rounded-full border border-(--line) px-5 py-2.5 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink)"
          >
            AI settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-(--line-soft) bg-(--paper) px-8 py-14 text-center shadow-(--shadow-card)">
      <svg className="mx-auto animate-spin" width="36" height="36" viewBox="0 0 30 30" aria-hidden>
        <path
          d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-5 font-serif text-2xl text-(--ink)">Preparing your morning brief</p>
      <p className="mt-2 text-sm text-(--muted) transition-opacity" aria-live="polite">
        {STAGES[stage]}
      </p>
    </div>
  );
}
