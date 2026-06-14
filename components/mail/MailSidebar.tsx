"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { GmailLabel } from "@/lib/gmail";

type IconName =
  | "inbox"
  | "star"
  | "clock"
  | "important"
  | "sent"
  | "schedule"
  | "draft"
  | "spam"
  | "trash"
  | "all"
  | "label";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "inbox":
      return (
        <svg {...common}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "important":
      return (
        <svg {...common}>
          <path d="M22 12 13 2v4.5C6 7 3 12 2 18c2.5-3 5.5-4.5 11-4.5V18l9-6z" />
        </svg>
      );
    case "sent":
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...common}>
          <path d="m22 2-11 11" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
      );
    case "draft":
      return (
        <svg {...common}>
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "spam":
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "all":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
    case "label":
      return (
        <svg {...common}>
          <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <path d="M7 7h.01" />
        </svg>
      );
  }
}

type FolderDef = {
  label: string;
  icon: IconName;
  href: string;
  /** Gmail label id whose unread count is shown as a badge (omit = no badge). */
  countLabel?: string;
  /** Matches the active folder (see resolveActive). */
  match: string;
};

const FOLDERS: FolderDef[] = [
  { label: "Inbox", icon: "inbox", href: "/mail", countLabel: "INBOX", match: "inbox" },
  { label: "Starred", icon: "star", href: "/mail?folder=starred", match: "starred" },
  { label: "Snoozed", icon: "clock", href: "/mail?view=snoozed", match: "snoozed" },
  { label: "Important", icon: "important", href: "/mail?folder=important", match: "important" },
  { label: "Sent", icon: "sent", href: "/mail?folder=sent", match: "sent" },
  { label: "Scheduled", icon: "schedule", href: "/mail?view=scheduled", match: "scheduled" },
  { label: "Drafts", icon: "draft", href: "/mail?folder=drafts", countLabel: "DRAFT", match: "drafts" },
  { label: "Spam", icon: "spam", href: "/mail?folder=spam", countLabel: "SPAM", match: "spam" },
  { label: "Trash", icon: "trash", href: "/mail?folder=trash", match: "trash" },
  { label: "All Mail", icon: "all", href: "/mail?folder=all", match: "all" },
];

export function MailSidebar({
  custom,
  unread,
}: {
  custom: GmailLabel[];
  unread: Record<string, number>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view");
  const folder = params.get("folder");
  const activeLabel = params.get("label");
  const q = params.get("q");

  // Which folder is active right now.
  let active = "";
  if (pathname === "/mail") {
    if (view === "snoozed") active = "snoozed";
    else if (view === "scheduled") active = "scheduled";
    else if (folder) active = folder;
    else if (!q) active = "inbox";
  }

  return (
    <aside className="hidden w-52 shrink-0 md:block">
      <Link
        href="/mail/compose"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-(--ink) px-4 py-2.5 text-sm font-semibold text-(--bg) shadow-(--shadow-card) transition hover:bg-(--accent)"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Compose
      </Link>

      <nav className="space-y-0.5">
        {FOLDERS.map((f) => {
          const isActive = active === f.match;
          const count = f.countLabel ? unread[f.countLabel] ?? 0 : 0;
          return (
            <Link
              key={f.match}
              href={f.href}
              className={`flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition ${
                isActive
                  ? "bg-(--accent-soft) font-semibold text-(--accent-deep)"
                  : "text-(--ink-soft) hover:bg-(--bg-deep) hover:text-(--ink)"
              }`}
            >
              <span className={isActive ? "text-(--accent)" : "text-(--muted)"}>
                <Icon name={f.icon} />
              </span>
              <span className="flex-1 truncate">{f.label}</span>
              {count > 0 && (
                <span className="shrink-0 text-xs font-semibold tabular-nums">{count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {custom.length > 0 && (
        <div className="mt-5">
          <p className="px-3.5 pb-1 text-[11px] font-bold tracking-widest text-(--muted) uppercase">
            Labels
          </p>
          <nav className="space-y-0.5">
            {custom.map((l) => {
              const isActive = activeLabel === l.id;
              return (
                <Link
                  key={l.id}
                  href={`/mail?label=${encodeURIComponent(l.id)}`}
                  className={`flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition ${
                    isActive
                      ? "bg-(--accent-soft) font-semibold text-(--accent-deep)"
                      : "text-(--ink-soft) hover:bg-(--bg-deep) hover:text-(--ink)"
                  }`}
                >
                  <span className={isActive ? "text-(--accent)" : "text-(--muted)"}>
                    <Icon name="label" />
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  {l.unread > 0 && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{l.unread}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}
