"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <div className="rounded-2xl border border-(--line-soft) bg-(--paper) px-8 py-10 text-center shadow-(--shadow-card)">
        <h1 className="font-serif text-2xl text-(--ink)">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-(--muted)">
          We hit an error loading this page. If your Gmail or Calendar connection
          has expired, reconnect your account — otherwise try again.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/connect"
            className="w-full rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) sm:w-auto"
          >
            Reconnect account
          </Link>
          <button
            onClick={reset}
            className="w-full rounded-full border border-(--line) px-5 py-2.5 text-sm font-semibold text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink) sm:w-auto"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
