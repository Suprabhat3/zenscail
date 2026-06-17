"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/mail", label: "Mail" },
  { href: "/settings/ai", label: "AI models" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/connect", label: "Connected accounts" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto border-b border-(--line-soft)">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
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
