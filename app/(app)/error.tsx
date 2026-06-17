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
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-serif text-2xl text-neutral-100">Something went wrong</h1>
      <p className="mt-3 text-sm text-neutral-400">
        We hit an unexpected error loading this page. This is usually temporary —
        try again, and if it persists you may need to reconnect your account.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
        >
          Try again
        </button>
        <Link
          href="/connect"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          Reconnect account
        </Link>
      </div>
    </div>
  );
}
