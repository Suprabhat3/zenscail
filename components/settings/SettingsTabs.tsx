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
    <div className="mt-4 flex gap-1 border-b border-neutral-800">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              active
                ? "border-amber-400 font-medium text-neutral-50"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
