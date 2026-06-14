"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette } from "@/components/command/CommandProvider";

const CHEATSHEET: [string, string][] = [
  ["⌘K / Ctrl+K", "Command palette"],
  ["c", "Compose"],
  ["r", "Reply (in a thread)"],
  ["1 / 2 / 3", "Use a quick reply (in a thread)"],
  ["j / k", "Next / previous message"],
  ["Enter", "Open focused message"],
  ["e", "Archive focused message"],
  ["#", "Trash focused message"],
  ["h", "Snooze focused thread"],
  ["u", "Back to inbox"],
  ["/", "Focus search"],
  ["g then i", "Go to inbox"],
  ["g then c", "Go to calendar"],
  ["g then t", "Go to chat"],
  ["?", "Show this help"],
];

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return Boolean(
    el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable),
  );
}

function moveFocus(delta: 1 | -1) {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[data-thread-link]"),
  );
  if (links.length === 0) return;
  const current = links.findIndex((l) => l.contains(document.activeElement));
  const next = links[Math.min(links.length - 1, Math.max(0, current + delta))] ?? links[0];
  next.focus();
  next.scrollIntoView({ block: "nearest" });
}

function clickRowAction(action: "archive" | "trash" | "snooze") {
  const row = (document.activeElement as HTMLElement | null)?.closest("li");
  row
    ?.querySelector<HTMLButtonElement>(`button[data-row-action="${action}"]`)
    ?.click();
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const command = useCommandPalette();
  const [showHelp, setShowHelp] = useState(false);
  const pendingG = useRef(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K opens the command palette — works even while typing.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        command.toggle();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }
      if (isTyping()) return;

      if (pendingG.current) {
        pendingG.current = false;
        if (e.key === "i") router.push("/mail");
        if (e.key === "c") router.push("/calendar");
        if (e.key === "t") router.push("/chat");
        return;
      }

      switch (e.key) {
        case "g":
          pendingG.current = true;
          setTimeout(() => (pendingG.current = false), 1000);
          break;
        case "c":
          router.push("/mail/compose");
          break;
        case "r": {
          const reply = document.querySelector<HTMLTextAreaElement>("textarea[name='body']");
          if (reply) {
            e.preventDefault();
            reply.focus();
          }
          break;
        }
        case "u":
          router.push("/mail");
          break;
        case "/": {
          const search = document.querySelector<HTMLInputElement>("input[type='search']");
          if (search) {
            e.preventDefault();
            search.focus();
          }
          break;
        }
        case "j":
          moveFocus(1);
          break;
        case "k":
          moveFocus(-1);
          break;
        case "e":
          clickRowAction("archive");
          break;
        case "#":
          clickRowAction("trash");
          break;
        case "h": {
          const link = (document.activeElement as HTMLElement | null)?.closest("li")
            ?.querySelector<HTMLElement>("a[data-thread-id]");
          const threadId = link?.dataset.threadId;
          if (threadId) {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("zenscail:snooze", { detail: { threadId } }),
            );
          }
          break;
        }
        case "?":
          setShowHelp((s) => !s);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, command]);

  if (!showHelp) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-lg text-neutral-100">Keyboard shortcuts</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {CHEATSHEET.map(([keys, desc]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-neutral-400">{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-neutral-500">Press Esc to close.</p>
      </div>
    </div>
  );
}
