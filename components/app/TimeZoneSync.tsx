"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TZ_COOKIE = "tz";

/**
 * Publishes the browser's IANA timezone to the `tz` cookie so server-rendered
 * pages can format dates in the viewer's zone (see lib/timezone.ts). Runs once
 * on mount; only writes + refreshes when the stored value is missing or stale,
 * so it costs nothing on steady-state navigations.
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TZ_COOKIE}=`))
      ?.slice(TZ_COOKIE.length + 1);
    if (current === tz) return;
    // 1-year cookie, Lax so it rides normal navigations. IANA names are
    // cookie-safe characters, so no encoding is needed.
    document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax`;
    // Re-render server components now that the zone is known.
    router.refresh();
  }, [router]);
  return null;
}
