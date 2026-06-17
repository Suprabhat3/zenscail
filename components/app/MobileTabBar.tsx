"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Today",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </svg>
    ),
  },
  {
    href: "/mail",
    label: "Mail",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3.5 7 7.3 5.2a2 2 0 0 0 2.4 0L20.5 7" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9h17M8 3v3M16 3v3" />
      </svg>
    ),
  },
];

/**
 * Fixed bottom navigation for small screens — the PWA-style replacement for the
 * inline header nav (which is hidden below md:). Desktop never sees this.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="zs-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-(--line-soft) bg-(--bg)/90 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition ${
                  active ? "text-(--accent)" : "text-(--muted)"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                    active ? "bg-(--accent-soft)" : ""
                  }`}
                >
                  {tab.icon(active)}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
