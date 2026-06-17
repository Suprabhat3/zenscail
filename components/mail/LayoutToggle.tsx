"use client";

import { useRouter } from "next/navigation";

/**
 * Switches the inbox between bundled (triaged sections) and flat list. The
 * preference is a cookie the server reads on the next render — set it here and
 * refresh so the server re-groups.
 */
export function LayoutToggle({ layout }: { layout: "bundled" | "flat" }) {
  const router = useRouter();

  function choose(next: "bundled" | "flat") {
    if (next === layout) return;
    document.cookie = `mail_layout=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-full border border-(--line) p-0.5">
      {(["bundled", "flat"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => choose(opt)}
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
            layout === opt
              ? "bg-(--ink) text-(--bg)"
              : "text-(--muted) hover:text-(--ink)"
          }`}
        >
          {opt === "bundled" ? "Bundled" : "Flat"}
        </button>
      ))}
    </div>
  );
}
