"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/mail", label: "Mail" },
  { href: "/calendar", label: "Calendar" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      <Link href="/dashboard" className="mr-5 flex items-center gap-2 font-serif text-lg text-(--ink)">
        <svg width="24" height="24" viewBox="0 0 30 30" aria-hidden="true">
          <path
            d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="23.5" cy="7.5" r="3.4" fill="var(--accent)" />
        </svg>
        ZenScail
      </Link>
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-(--ink) text-(--bg)"
                : "text-(--ink-soft) hover:bg-(--bg-deep) hover:text-(--ink)"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
