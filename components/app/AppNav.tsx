"use client";

import Link from "next/link";
import Image from "next/image";
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
        <Image src="/logo.png" alt="ZenScail" width={27} height={24} />
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
