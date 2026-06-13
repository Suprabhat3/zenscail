"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { useRouter, usePathname } from "next/navigation";
import { useCommandPalette } from "./CommandProvider";
import { useChatDock } from "@/components/chat/ChatProvider";
import { searchInbox, type CommandSearchResult } from "@/app/(app)/command/actions";
import { refreshInbox } from "@/app/(app)/mail/actions";

function IconNav() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

type StaticCommand = {
  id: string;
  label: string;
  keywords: string;
  group: "Navigate" | "Actions";
  icon: React.ReactNode;
  perform: () => void;
};

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const { openWith } = useChatDock();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CommandSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);

  const onThread = Boolean(pathname?.startsWith("/mail/thread/"));

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    [setOpen],
  );

  // Reset query each time the palette closes.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSearching(false);
    }
  }, [open]);

  // Debounced mail search (only on its own request id to avoid races).
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const myId = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const found = await searchInbox(q);
        if (myId === reqId.current) setResults(found);
      } catch {
        if (myId === reqId.current) setResults([]);
      } finally {
        if (myId === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const commands = useMemo<StaticCommand[]>(() => {
    const list: StaticCommand[] = [
      { id: "nav-today", label: "Go to Today", keywords: "dashboard home", group: "Navigate", icon: <IconNav />, perform: () => router.push("/dashboard") },
      { id: "nav-inbox", label: "Go to Inbox", keywords: "mail email", group: "Navigate", icon: <IconNav />, perform: () => router.push("/mail") },
      { id: "nav-calendar", label: "Go to Calendar", keywords: "events schedule", group: "Navigate", icon: <IconNav />, perform: () => router.push("/calendar") },
      { id: "nav-settings", label: "Go to Settings", keywords: "preferences ai profile", group: "Navigate", icon: <IconNav />, perform: () => router.push("/settings") },
      { id: "act-compose", label: "Compose new email", keywords: "write send mail new", group: "Actions", icon: <IconBolt />, perform: () => router.push("/mail/compose") },
      { id: "act-refresh", label: "Refresh inbox", keywords: "sync gmail reload", group: "Actions", icon: <IconBolt />, perform: () => void refreshInbox().catch(() => {}) },
      { id: "act-event", label: "New calendar event", keywords: "meeting schedule create", group: "Actions", icon: <IconBolt />, perform: () => router.push("/calendar/new") },
      { id: "act-urgent", label: "Show urgent mail first", keywords: "priority important filter", group: "Actions", icon: <IconBolt />, perform: () => router.push("/mail?view=urgent") },
    ];
    if (onThread) {
      list.push({
        id: "act-reply",
        label: "Reply to this thread",
        keywords: "respond answer message",
        group: "Actions",
        icon: <IconMail />,
        perform: () => {
          const reply = document.querySelector<HTMLTextAreaElement>("textarea[name='body']");
          reply?.focus();
          reply?.scrollIntoView({ block: "center" });
        },
      });
    }
    return list;
  }, [router, onThread]);

  const trimmed = search.trim();
  const needle = trimmed.toLowerCase();
  const matched = needle
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(needle) ||
          c.keywords.includes(needle),
      )
    : commands;

  const navItems = matched.filter((c) => c.group === "Navigate");
  const actionItems = matched.filter((c) => c.group === "Actions");

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={false}
      className="flex flex-col"
      overlayClassName="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
      contentClassName="fixed left-1/2 top-[12vh] z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-(--line) bg-(--paper) shadow-2xl"
    >
      <div className="flex items-center gap-2.5 border-b border-(--line-soft) px-4">
        <svg className="text-(--muted)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search or jump to…"
          className="w-full bg-transparent py-3.5 text-sm text-(--ink) placeholder:text-(--muted) focus:outline-none"
        />
        {searching && <span className="shrink-0 text-xs text-(--muted)">Searching…</span>}
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-(--muted)">
          No matches.
        </Command.Empty>

        {navItems.length > 0 && (
          <Command.Group heading="Navigate" className="cmd-group">
            {navItems.map((c) => (
              <Command.Item key={c.id} value={c.id} onSelect={() => run(c.perform)} className="cmd-item">
                <span className="text-(--muted)">{c.icon}</span>
                <span className="flex-1 truncate text-sm text-(--ink)">{c.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {actionItems.length > 0 && (
          <Command.Group heading="Actions" className="cmd-group">
            {actionItems.map((c) => (
              <Command.Item key={c.id} value={c.id} onSelect={() => run(c.perform)} className="cmd-item">
                <span className="text-(--muted)">{c.icon}</span>
                <span className="flex-1 truncate text-sm text-(--ink)">{c.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {results.length > 0 && (
          <Command.Group heading="Mail" className="cmd-group">
            {results.map((m) => (
              <Command.Item
                key={m.id}
                value={`mail-${m.id}`}
                onSelect={() => run(() => router.push(`/mail/thread/${m.threadId}`))}
                className="cmd-item"
              >
                <span className="text-(--muted)">
                  <IconMail />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-(--ink)">
                    {m.subject || "(no subject)"}
                  </span>
                  <span className="block truncate text-xs text-(--muted)">
                    {m.from || "(unknown)"} — {m.snippet}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {trimmed.length > 0 && (
          <Command.Group heading="AI" className="cmd-group">
            <Command.Item
              value="ask-ai-escape-hatch"
              onSelect={() => run(() => openWith(trimmed))}
              className="cmd-item"
            >
              <span className="text-(--accent)">
                <IconSparkle />
              </span>
              <span className="flex-1 truncate text-sm text-(--ink)">
                Ask ZenScail: <span className="text-(--ink-soft)">“{trimmed}”</span>
              </span>
            </Command.Item>
          </Command.Group>
        )}
      </Command.List>

      <div className="flex items-center justify-between border-t border-(--line-soft) px-4 py-2 text-[11px] text-(--muted)">
        <span>
          <kbd className="rounded border border-(--line) bg-(--bg) px-1">↑</kbd>{" "}
          <kbd className="rounded border border-(--line) bg-(--bg) px-1">↓</kbd> to navigate
        </span>
        <span>
          <kbd className="rounded border border-(--line) bg-(--bg) px-1">↵</kbd> to select ·{" "}
          <kbd className="rounded border border-(--line) bg-(--bg) px-1">esc</kbd> to close
        </span>
      </div>
    </Command.Dialog>
  );
}
