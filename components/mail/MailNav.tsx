"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { BrandLoader } from "@/components/app/BrandLoader";

const NAV_LOADER_MESSAGES = [
  "Gathering your conversations…",
  "Reading what landed since you left…",
  "Sorting signal from the noise…",
  "Surfacing what needs you first…",
];

type MailNavValue = {
  /** A folder navigation is in flight. */
  active: boolean;
  /** Label of the folder being opened (for the loader title). */
  label: string | null;
  /** Reported by each folder link from its useLinkStatus pending state. */
  report: (id: string, pending: boolean, label: string) => void;
};

const MailNavContext = createContext<MailNavValue | null>(null);

/**
 * Tracks the pending state of in-place folder switches so the loader can be
 * scoped to the message list instead of taking over the whole page.
 *
 * Switching folders is a searchParams-only change on /mail, so Next keeps the
 * stale page mounted and never falls back to loading.tsx. The sidebar links
 * report their useLinkStatus pending state here; <MailBody> reads it and shows
 * the BrandLoader in place of the list while the new folder loads — the
 * sidebar, header, and tabs stay exactly where they are.
 */
export function MailNavProvider({ children }: { children: React.ReactNode }) {
  // Map of pending link id → its folder label. More than one is never truly
  // pending at once, but tracking per-id avoids races between a link going
  // pending and another link's cleanup effect firing.
  const pendingRef = useRef(new Map<string, string>());
  const [state, setState] = useState<{ active: boolean; label: string | null }>({
    active: false,
    label: null,
  });

  const report = useCallback((id: string, pending: boolean, label: string) => {
    const m = pendingRef.current;
    if (pending) m.set(id, label);
    else m.delete(id);
    const first = m.values().next();
    setState({ active: m.size > 0, label: first.done ? null : first.value });
  }, []);

  return (
    <MailNavContext.Provider value={{ ...state, report }}>{children}</MailNavContext.Provider>
  );
}

function useMailNav(): MailNavValue {
  const ctx = useContext(MailNavContext);
  if (!ctx) throw new Error("useMailNav must be used within a MailNavProvider");
  return ctx;
}

/**
 * Invisible reporter placed inside each folder <Link>. Pushes the link's
 * navigation pending state up to the provider. Must be a descendant of the
 * <Link> whose status it tracks (that's how useLinkStatus finds it).
 */
export function FolderNavReporter({ id, label }: { id: string; label: string }) {
  const { pending } = useLinkStatus();
  const { report } = useMailNav();
  useEffect(() => {
    report(id, pending, label);
    // Clean up so an unmounting link never leaves a stale "pending" entry
    // behind once the new folder finishes rendering.
    return () => report(id, false, label);
  }, [id, pending, label, report]);
  return null;
}

/**
 * Wraps the mail message list. While a folder navigation is pending it renders
 * the BrandLoader in the content area; otherwise it renders the list as-is.
 */
export function MailBody({ children }: { children: React.ReactNode }) {
  const { active, label } = useMailNav();
  if (active) {
    return (
      <BrandLoader
        title={label ? `Opening ${label}` : "Opening your mail"}
        messages={NAV_LOADER_MESSAGES}
      />
    );
  }
  return <>{children}</>;
}
