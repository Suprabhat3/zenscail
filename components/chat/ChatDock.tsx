"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { useChatDock } from "./ChatProvider";
import { Markdown } from "./Markdown";

export type ChatModelOption = { id: string; label: string };

type Props = {
  tier: "cloud" | "byok";
  provider: string;
  defaultModel: string;
  models: ChatModelOption[];
};

function toolLabel(toolName: string): string {
  if (toolName.includes("send")) return "Sending email…";
  if (toolName.includes("events.create")) return "Creating event…";
  if (toolName.includes("events.update")) return "Updating event…";
  if (toolName.includes("delete") || toolName.includes("trash")) return "Deleting…";
  if (toolName.includes("get") || toolName.includes("list") || toolName.includes("search"))
    return "Looking things up…";
  return `Working: ${toolName}`;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith("/mail")) {
    return [
      "What are my most important unread emails?",
      "Summarize what came into my inbox today",
      "Draft a reply to the latest email that needs one",
      "Archive everything that's just a newsletter",
    ];
  }
  if (pathname.startsWith("/calendar")) {
    return [
      "What does my schedule look like this week?",
      "Find me a free 30-minute slot tomorrow",
      "Do I have any conflicting meetings coming up?",
      "Move my next meeting back by an hour",
    ];
  }
  // Dashboard and everywhere else.
  return [
    "Walk me through today's brief in more detail",
    "What's the single most important thing to do today?",
    "Summarize yesterday's emails I haven't read",
    "What meetings do I have today and with whom?",
  ];
}

export function ChatDock({ tier, provider, defaultModel, models }: Props) {
  const { open, setOpen, seed, consumeSeed } = useChatDock();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [model, setModel] = useState(defaultModel);
  const { messages, sendMessage, status, error, setMessages } = useChat();
  const busy = status === "submitted" || status === "streaming";

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendMessage({ text: trimmed }, { body: { model } });
      setInput("");
    },
    [sendMessage, model],
  );

  // A prompt queued from elsewhere in the UI (e.g. dashboard's "Ask about this
  // brief"). Deferred a tick so we're not setting state synchronously in the effect.
  useEffect(() => {
    if (!open || !seed || busy) return;
    const id = setTimeout(() => {
      send(seed);
      consumeSeed();
    }, 0);
    return () => clearTimeout(id);
  }, [open, seed, busy, send, consumeSeed]);

  // Stick to the bottom as messages stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  // Focus the input when opened; Escape closes.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {/* Scrim (mobile only) */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-(--ink)/25 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Panel */}
      <aside
        aria-label="ZenScail assistant"
        className={`fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-(--line-soft) bg-(--paper) shadow-(--shadow-float) transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)] sm:w-105 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-(--line-soft) bg-(--bg) px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--accent-soft)">
              <svg width="16" height="16" viewBox="0 0 30 30" aria-hidden="true">
                <path
                  d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="23.5" cy="7.5" r="3.4" fill="var(--accent)" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-(--ink)">Assistant</p>
              <p className="truncate text-[11px] text-(--muted)">
                {tier === "byok"
                  ? `Your ${PROVIDER_LABELS[provider] ?? provider} key`
                  : "ZenScail Cloud"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Model"
              className="max-w-37.5 rounded-lg border border-(--line) bg-(--paper) px-2 py-1.5 text-xs font-medium text-(--ink-soft) focus:border-(--accent) focus:outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="New conversation"
                aria-label="New conversation"
                className="rounded-lg p-1.5 text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              title="Close (Esc)"
              aria-label="Close chat"
              className="rounded-lg p-1.5 text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.length === 0 && (
            <div className="pt-2">
              <p className="font-serif text-xl text-(--ink)">How can I help?</p>
              <p className="mt-1 text-sm text-(--muted)">
                I can read, draft, and act on your mail and calendar.
              </p>
              <ul className="mt-4 space-y-2">
                {suggestionsFor(pathname).map((prompt) => (
                  <li key={prompt}>
                    <button
                      onClick={() => send(prompt)}
                      className="w-full rounded-xl border border-(--line-soft) bg-(--bg) px-4 py-2.5 text-left text-sm text-(--ink-soft) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-deep)"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-(--ink) text-(--bg)"
                    : "border border-(--line-soft) bg-(--bg) text-(--ink-soft)"
                }`}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "user" ? (
                      <p key={i} className="whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    ) : (
                      <Markdown key={i}>{part.text}</Markdown>
                    );
                  }
                  if (part.type === "dynamic-tool") {
                    const done = part.state === "output-available";
                    return (
                      <div key={i} className="my-1 flex items-center gap-2 text-xs text-(--muted)">
                        <span className={done ? "text-(--sage)" : "text-(--accent)"}>
                          {done ? "✓" : "⋯"}
                        </span>
                        <span>{done ? `Done: ${part.toolName}` : toolLabel(part.toolName)}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex">
              <div className="rounded-2xl border border-(--line-soft) bg-(--bg) px-4 py-3 text-sm text-(--muted)">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce [animation-delay:0ms]">·</span>
                  <span className="animate-bounce [animation-delay:150ms]">·</span>
                  <span className="animate-bounce [animation-delay:300ms]">·</span>
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-(--accent)/30 bg-(--accent-soft) px-4 py-3 text-sm text-(--accent-deep)">
              {error.message || "Something went wrong."}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) send(input);
          }}
          className="flex gap-2 border-t border-(--line-soft) bg-(--bg) p-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your mail or calendar…"
            className="min-w-0 flex-1 rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          />
          <button
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ink) text-(--bg) transition hover:bg-(--accent) disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </aside>
    </>
  );
}
