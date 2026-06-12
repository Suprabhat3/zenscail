"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function UserMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
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
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-800 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
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
          className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-neutral-700 bg-neutral-900 py-2 shadow-xl shadow-black/40"
        >
          <div className="border-b border-neutral-800 px-4 pb-2.5">
            <p className="truncate text-sm font-medium text-neutral-100">{name}</p>
            <p className="truncate text-xs text-neutral-500">{email}</p>
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
                className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-neutral-800 pt-1">
            <button
              role="menuitem"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-neutral-800"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
