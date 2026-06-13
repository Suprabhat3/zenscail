"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function UserMenu({
  name,
  email,
  loginEmail,
  image,
}: {
  name: string;
  email: string;
  /** When set, the app-login email differs from the connected mailbox (`email`). */
  loginEmail?: string;
  image?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name || email).trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-(--line) bg-(--bg-deep) text-sm font-semibold text-(--ink) transition hover:border-(--ink)"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-(--line) bg-(--paper) py-2 shadow-(--shadow-float)"
        >
          <div className="border-b border-(--line-soft) px-4 pb-2.5">
            <p className="truncate text-sm font-semibold text-(--ink)">{name}</p>
            <p className="truncate text-xs text-(--muted)">{email}</p>
            {loginEmail && (
              <p className="mt-0.5 truncate text-[11px] text-(--muted)">
                signed in as {loginEmail}
              </p>
            )}
          </div>
          <div className="py-1">
            {[
              { href: "/settings/profile", label: "Profile" },
              { href: "/settings/ai", label: "AI settings" },
              { href: "/connect", label: "Connected accounts" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink)"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-(--line-soft) pt-1">
            <button
              role="menuitem"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-(--accent) transition hover:bg-(--accent-soft)"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
