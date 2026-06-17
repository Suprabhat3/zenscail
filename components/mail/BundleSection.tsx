"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bundleAction } from "@/app/(app)/mail/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Collapsible inbox bundle. Receives already-rendered rows as children (kept on
 * the server so the message rows reuse the same markup as the flat view) and
 * adds a header with counts, collapse state (remembered per category), and
 * batch "Mark all read" / "Archive all" actions.
 */
export function BundleSection({
  category,
  emoji,
  title,
  ids,
  unread,
  defaultOpen = true,
  children,
}: {
  category: string;
  emoji: string;
  title: string;
  ids: string[];
  unread: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const storageKey = `zenscail_bundle_open_${category}`;
  const [open, setOpen] = useState(defaultOpen);
  const ready = useRef(false);

  useEffect(() => {
    // Restore the remembered collapse state from localStorage. This must run
    // after mount (not a useState initializer) so SSR and first client render
    // agree on `defaultOpen` — the post-hydration update is intentional.
    const raw = window.localStorage.getItem(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage (external store) on mount
    if (raw != null) setOpen(raw === "1");
    ready.current = true;
  }, [storageKey]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  function run(op: "read" | "archive", label: string) {
    startTransition(async () => {
      const res = await bundleAction(ids, op).catch(() => ({ ok: false }));
      toast(res.ok ? label : "Something went wrong");
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-card)">
      <div className="flex items-center gap-2 border-b border-(--line-soft) bg-(--bg)/50 px-4 py-2.5">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <svg
            className={`shrink-0 text-(--muted) transition-transform ${open ? "rotate-90" : ""}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span aria-hidden className="shrink-0">{emoji}</span>
          <span className="truncate text-sm font-semibold text-(--ink)">{title}</span>
          <span className="shrink-0 text-xs whitespace-nowrap text-(--muted)">
            {ids.length}
            {unread > 0 && <span className="text-(--accent)"> · {unread} unread</span>}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("read", "Marked all read")}
              title="Mark all read"
              aria-label="Mark all read"
              className="flex items-center gap-1.5 rounded-full p-1.5 text-xs font-medium text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink) disabled:opacity-50 sm:px-2.5 sm:py-1"
            >
              <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m3 12 5 5L20 5" />
              </svg>
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run("archive", "Bundle archived")}
            title="Archive all"
            aria-label="Archive all"
            className="flex items-center gap-1.5 rounded-full p-1.5 text-xs font-medium text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink) disabled:opacity-50 sm:px-2.5 sm:py-1"
          >
            <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
            </svg>
            <span className="hidden sm:inline">Archive all</span>
          </button>
        </div>
      </div>
      {open && <ul className="divide-y divide-(--line-soft)">{children}</ul>}
    </div>
  );
}
