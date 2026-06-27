"use client";

import Link, { useLinkStatus } from "next/link";
import { BrandLoader } from "@/components/app/BrandLoader";

const DEFAULT_MESSAGES = [
  "Gathering your events…",
  "Lining up what's ahead…",
  "Finding the open spaces in your day…",
  "Almost ready.",
];

/**
 * Full-bleed loading screen shown while this link's navigation is pending.
 *
 * Switching the calendar view/date is a searchParams-only change on the same
 * /calendar segment, so Next keeps the stale page mounted and never falls back
 * to loading.tsx. useLinkStatus gives us the per-link pending state (only the
 * last-clicked link reports pending) so we can show the same BrandLoader the
 * route shows on a fresh load.
 */
function PendingOverlay({ title, messages }: { title?: string; messages: string[] }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-(--bg)">
      <BrandLoader title={title} messages={messages} />
    </div>
  );
}

/**
 * A drop-in `<Link>` that renders a branded loading screen while its navigation
 * is in flight. Use for in-place navigations (same route, changing query
 * params) that Next won't cover with a loading.tsx fallback.
 */
export function PendingLink({
  href,
  className,
  title,
  ariaLabel,
  loaderTitle,
  loaderMessages,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
  loaderTitle?: string;
  loaderMessages?: string[];
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} title={title} aria-label={ariaLabel}>
      {children}
      <PendingOverlay title={loaderTitle} messages={loaderMessages ?? DEFAULT_MESSAGES} />
    </Link>
  );
}
