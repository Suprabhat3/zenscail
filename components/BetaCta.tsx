"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

/**
 * Beta-phase call to action — replaces the old waitlist form. Signed-in users
 * get a straight shot to the app; everyone else gets sign-up / sign-in.
 */
export function BetaCta({ showNote = false }: { showNote?: boolean }) {
  const { data: session, isPending } = useSession();

  return (
    <div className="waitlist-wrap" style={{ marginTop: 36 }}>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
        // Avoid a flash of the signed-out buttons before the session resolves.
        aria-busy={isPending}
      >
        {session ? (
          <Link className="btn btn-accent" href="/dashboard">
            Open your dashboard →
          </Link>
        ) : (
          <>
            <Link className="btn btn-accent" href="/login?mode=signup">
              Get started — it&rsquo;s free
            </Link>
            <Link
              className="btn btn-ghost"
              href="/login"
              style={{ visibility: isPending ? "hidden" : undefined }}
            >
              Sign in
            </Link>
          </>
        )}
      </div>
      {showNote && (
        <p className="waitlist-note">
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <path
              d="M 2 8 L 6 12 L 13 3"
              fill="none"
              stroke="var(--sage)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Now in open beta — free with your own API keys. No card needed.</span>
        </p>
      )}
    </div>
  );
}
