"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/mail", label: "Mail" },
  { href: "/calendar", label: "Calendar" },
  { href: "/chat", label: "Chat" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      <Link href="/mail" className="mr-5 flex items-center gap-2 font-serif text-lg text-neutral-50">
        <svg width="24" height="24" viewBox="0 0 30 30" aria-hidden="true">
          <path
            d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="23.5" cy="7.5" r="3.4" fill="#f59e0b" />
        </svg>
        ZenScail
      </Link>
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? "bg-neutral-800 font-medium text-neutral-50"
                : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
