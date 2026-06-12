"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/ai", label: "AI models" },
  { href: "/connect", label: "Connected accounts" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="mt-4 flex gap-1 border-b border-(--line-soft)">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-(--accent) text-(--accent)"
                : "border-transparent text-(--muted) hover:text-(--ink)"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
