"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DemoContextValue = {
  /** True while the visitor is touring the app without an account. */
  active: boolean;
  /** Open the "one login away" prompt (optionally with a tailored line). */
  requireLogin: (reason?: string) => void;
};

const DemoContext = createContext<DemoContextValue>({
  active: false,
  requireLogin: () => {},
});

export function useDemo(): DemoContextValue {
  return useContext(DemoContext);
}

// Routes a demo visitor can't reach without logging in — anything that composes,
// schedules, opens a real thread/event, or touches account settings. Plain
// browsing (/dashboard, /mail, /calendar and their query-string views) is allowed.
const BLOCKED_PREFIXES = [
  "/mail/compose",
  "/mail/thread/",
  "/calendar/new",
  "/calendar/event/",
  "/calendar/links",
  "/settings",
  "/connect",
  "/onboarding",
];

function isBlockedHref(href: string): boolean {
  if (!href.startsWith("/")) return false; // external / anchor links are fine
  if (href.startsWith("/login")) return false;
  return BLOCKED_PREFIXES.some((p) => href === p || href.startsWith(p));
}

export function DemoProvider({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(null);

  const requireLogin = useCallback((reason?: string) => {
    setPrompt(
      reason ??
        "Sign in to compose mail, schedule events, and let the assistant act for you.",
    );
  }, []);

  // Global capture-phase guards. Rather than thread a demo flag through every
  // button, we intercept the two things that would hit a real action: clicking
  // a link into a blocked route, and submitting any POST (server-action) form.
  // Read-only GET forms (the mail search box) and in-app navigation pass through.
  useEffect(() => {
    if (!active) return;

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (isBlockedHref(anchor.getAttribute("href") || "")) {
        e.preventDefault();
        e.stopPropagation();
        requireLogin();
      }
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const method = (form.getAttribute("method") || "get").toLowerCase();
      if (method === "post") {
        e.preventDefault();
        e.stopPropagation();
        requireLogin();
      }
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [active, requireLogin]);

  const value = useMemo(() => ({ active, requireLogin }), [active, requireLogin]);

  return (
    <DemoContext.Provider value={value}>
      {active && <DemoBanner onLogin={() => router.push("/login")} />}
      {children}
      {active && prompt && (
        <DemoLoginModal
          reason={prompt}
          onLogin={() => router.push("/login")}
          onDismiss={() => setPrompt(null)}
        />
      )}
    </DemoContext.Provider>
  );
}

function DemoBanner({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-(--ink) px-4 py-2 text-center text-sm text-(--bg)">
      <span className="font-medium">
        ✨ You&rsquo;re exploring a live demo of ZenScail — everything here is sample data.
      </span>
      <button
        onClick={onLogin}
        className="rounded-full bg-(--bg) px-3 py-1 text-xs font-semibold text-(--ink) transition hover:bg-(--accent) hover:text-white"
      >
        Log in to make it real →
      </button>
    </div>
  );
}

function DemoLoginModal({
  reason,
  onLogin,
  onDismiss,
}: {
  reason: string;
  onLogin: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-(--ink)/40 p-4 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to continue"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-(--line-soft) bg-(--paper) shadow-(--shadow-float)"
      >
        <div className="bg-(--accent-soft)/50 px-7 pt-7 pb-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--accent-soft)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-(--accent)" aria-hidden>
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
          </div>
          <h2 className="mt-4 font-serif text-2xl text-(--ink)">
            You&rsquo;re one login away
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-(--ink-soft)">{reason}</p>
        </div>

        <div className="flex flex-col gap-2.5 px-7 py-6">
          <button
            onClick={onLogin}
            className="w-full rounded-full bg-(--accent) px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
          >
            Log in or create an account
          </button>
          <button
            onClick={onDismiss}
            className="w-full rounded-full px-3 py-2.5 text-sm font-semibold text-(--ink-soft) transition hover:bg-(--bg-deep) hover:text-(--ink)"
          >
            Keep exploring the demo
          </button>
        </div>
      </div>
    </div>
  );
}
