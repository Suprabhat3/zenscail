"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type ConnectPlugin } from "@/app/(app)/connect/plugins";

/** Channel name the opener listens on to know a plugin finished connecting. */
const DONE_MESSAGE = "zenscail:connect-complete";

/**
 * The popup lands here after authorizing a single plugin. We tell the opener
 * which plugin just connected and close — the opener drives the next step. One
 * plugin per popup keeps the flow staged and legible (Gmail, then Calendar)
 * instead of re-opening what looks like the same consent twice.
 */
function ConnectCallback() {
  const params = useSearchParams();
  const justFinished = params.get("plugin") as ConnectPlugin | null;
  const oauthError = params.get("error");
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard against React strict-mode double-invocation.
    if (ranRef.current) return;
    ranRef.current = true;

    if (oauthError) {
      setError("Authorization was cancelled or failed.");
      return;
    }

    try {
      window.opener?.postMessage(
        { type: DONE_MESSAGE, plugin: justFinished },
        window.location.origin,
      );
    } catch {
      // Opener gone (e.g. user navigated away) — closing is enough.
    }
    window.close();
  }, [justFinished, oauthError]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <p className="text-sm font-medium text-(--accent-deep)">{error}</p>
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-4 rounded-full border border-(--line) bg-(--paper) px-4 py-2 text-sm font-semibold text-(--ink) transition hover:border-(--ink)"
          >
            Close window
          </button>
        </>
      ) : (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--line) border-t-(--accent)" />
          <p className="mt-4 text-sm text-(--ink-soft)">Finishing up…</p>
        </>
      )}
    </div>
  );
}

export default function ConnectCallbackPage() {
  return (
    <Suspense fallback={null}>
      <ConnectCallback />
    </Suspense>
  );
}
