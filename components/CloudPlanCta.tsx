"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { getMyCloudStatus, type CloudStatus } from "@/app/cloud-status-actions";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Pricing-card CTA for the Cloud plan, aware of the visitor's subscription.
 * - Logged out → "Get ZenScail Cloud" (sign up).
 * - Active subscriber → renewal/active-until status + "Manage subscription"
 *   (no buy button — they already have it).
 * - Signed in without a plan → "Get ZenScail Cloud" (to Billing).
 * Matches the client `useSession` pattern used by BetaCta.
 */
export function CloudPlanCta() {
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    getMyCloudStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [session]);

  // Resolving auth state — keep the CTA visible but inert to avoid a flash.
  if (isPending) {
    return (
      <span className="btn btn-accent" style={{ opacity: 0.6, pointerEvents: "none" }}>
        Get ZenScail Cloud
      </span>
    );
  }

  if (!session) {
    return (
      <Link className="btn btn-accent" href="/login?mode=signup">
        Get ZenScail Cloud
      </Link>
    );
  }

  if (!loaded) {
    return (
      <span className="btn btn-accent" style={{ opacity: 0.6, pointerEvents: "none" }}>
        Checking your plan…
      </span>
    );
  }

  if (status?.isActive) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            background: "var(--accent-soft, #FCE9ED)",
            color: "var(--accent-deep, #B81239)",
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          ✦ Your Cloud plan
        </span>
        <p style={{ margin: 0, fontSize: 14, color: "#5C5346" }}>
          {status.cancelAtPeriodEnd ? "Active until " : "Renews on "}
          <strong style={{ color: "#25201A" }}>{formatDate(status.currentEnd)}</strong>
        </p>
        <Link className="btn btn-ghost" href="/settings/billing" style={{ alignSelf: "flex-start" }}>
          Manage subscription
        </Link>
      </div>
    );
  }

  // Signed in but no active subscription — send them to Billing to upgrade.
  return (
    <Link className="btn btn-accent" href="/settings/billing">
      Get ZenScail Cloud
    </Link>
  );
}
