"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useChatDock } from "./ChatProvider";
import { Markdown } from "./Markdown";
import { MicButton } from "@/components/voice/MicButton";
import { useToast } from "@/components/ui/Toast";
import {
  saveConversation,
  listConversations,
  getConversation,
  setMessageFeedback,
  deleteConversation,
  type ConversationSummary,
} from "@/app/(app)/chat/history-actions";
import Image from "next/image";

export type ChatModelOption = { id: string; label: string };

type Props = {
  tier: "cloud" | "byok";
  provider: string;
  defaultModel: string;
  models: ChatModelOption[];
};

type Feedback = Record<string, "up" | "down">;

function newId(): string {
  return crypto.randomUUID();
}

function toolLabel(toolName: string): string {
  if (toolName.includes("send")) return "Sending email…";
  if (toolName.includes("events.create")) return "Creating event…";
  if (toolName.includes("events.update")) return "Updating event…";
  if (toolName.includes("delete") || toolName.includes("trash")) return "Deleting…";
  if (toolName.includes("get") || toolName.includes("list") || toolName.includes("search"))
    return "Looking things up…";
  return `Working: ${toolName}`;
}

/** Our review-first action tools that hand off a pre-filled page. */
const ACTION_TOOLS = ["composeEmail", "scheduleEvent", "searchMail"];

type ActionDirective = { url: string; label: string };

/** A finished action tool-part → the page to open, or null if not ready. */
function directiveOf(part: { type: string; state?: string; output?: unknown }): ActionDirective | null {
  if (!part.type.startsWith("tool-") || !ACTION_TOOLS.includes(part.type.slice(5))) return null;
  if (part.state !== "output-available") return null;
  const out = part.output as { url?: string; label?: string } | undefined;
  return out?.url ? { url: out.url, label: out.label || "Open" } : null;
}

/** The most recent ready directive across messages (for auto-redirect). */
function lastDirective(messages: UIMessage[]): ActionDirective | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts as { type: string; state?: string; output?: unknown }[];
    for (let j = parts.length - 1; j >= 0; j--) {
      const d = directiveOf(parts[j]);
      if (d) return d;
    }
  }
  return null;
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
  return [
    "Walk me through today's brief in more detail",
    "What's the single most important thing to do today?",
    "Summarize yesterday's emails I haven't read",
    "What meetings do I have today and with whom?",
  ];
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Concatenate the text parts of a message (for copy + title). */
function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");
}

export function ChatDock({ tier, provider, defaultModel, models }: Props) {
  const { open, setOpen, seed, consumeSeed } = useChatDock();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [feedback, setFeedback] = useState<Feedback>({});
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // The current conversation id. Mirrored into a ref so onFinish (set once on
  // the chat instance) always persists against the live id.
  const convIdRef = useRef<string>("");
  const restoredRef = useRef(false);
  // Mirror the queued seed so the restore effect can read it without
  // re-subscribing (it runs exactly once, on first open).
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const refreshHistory = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    onFinish: ({ messages: finished }) => {
      const id = convIdRef.current;
      if (!id) return;
      void saveConversation({
        id,
        messages: finished.map((m) => ({ id: m.id, role: m.role, parts: m.parts })),
      }).then((ok) => {
        if (ok) void refreshHistory();
      });
      // The assistant prepared an email / event / search — take the user to the
      // pre-filled screen so they can review and send/create.
      const directive = lastDirective(finished);
      if (directive) {
        setOpen(false);
        router.push(directive.url);
      }
    },
  });
  const busy = status === "submitted" || status === "streaming";

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const setConversation = useCallback((id: string) => {
    convIdRef.current = id;
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!convIdRef.current) setConversation(newId());
      sendMessage({ text: trimmed }, { body: { model } });
      setInput("");
    },
    [sendMessage, model, setConversation],
  );

  const loadConversation = useCallback(
    async (id: string) => {
      const convo = await getConversation(id);
      if (!convo) return;
      setConversation(convo.id);
      setMessages(convo.messages as unknown as UIMessage[]);
      setFeedback(convo.feedback);
      setHistoryOpen(false);
    },
    [setMessages, setConversation],
  );

  const newConversation = useCallback(() => {
    setMessages([]);
    setFeedback({});
    setConversation(newId());
    setInput("");
    setHistoryOpen(false);
    taRef.current?.focus();
  }, [setMessages, setConversation]);

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      setConversations((c) => c.filter((x) => x.id !== id));
      if (id === convIdRef.current) newConversation();
    },
    [newConversation],
  );

  const rate = useCallback(
    async (messageId: string, value: "up" | "down") => {
      const next = feedback[messageId] === value ? null : value;
      setFeedback((f) => {
        const copy = { ...f };
        if (next) copy[messageId] = next;
        else delete copy[messageId];
        return copy;
      });
      await setMessageFeedback(messageId, next);
    },
    [feedback],
  );

  const copyMessage = useCallback(
    (m: UIMessage) => {
      const text = messageText(m);
      if (!text) return;
      void navigator.clipboard
        .writeText(text)
        .then(() => toast("Copied to clipboard"))
        .catch(() => toast("Couldn't copy."));
    },
    [toast],
  );

  // First time the dock opens, restore the most recent conversation (and load
  // the history list); falls back to a fresh conversation if there are none.
  useEffect(() => {
    if (!open || restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      const items = await listConversations();
      setConversations(items);
      // A queued hand-off prompt starts its own conversation rather than
      // appending to whatever you were last doing.
      if (seedRef.current) {
        setConversation(newId());
        return;
      }
      if (items.length > 0) await loadConversation(items[0].id);
      else setConversation(newId());
    })();
  }, [open, loadConversation, setConversation]);

  // A prompt queued from elsewhere in the UI (e.g. the quick-add bar or the
  // dashboard's "Ask about this brief"). A hand-off always starts its OWN fresh
  // conversation — never appended to whatever was last loaded in the dock —
  // otherwise the agent would be handed the previous (already finished) thread
  // alongside the new command and reply to that first. Deferred a tick so we're
  // not setting state synchronously here.
  useEffect(() => {
    if (!open || !seed || busy) return;
    const id = setTimeout(() => {
      setMessages([]);
      setFeedback({});
      setConversation(newId());
      send(seed);
      consumeSeed();
    }, 0);
    return () => clearTimeout(id);
  }, [open, seed, busy, send, consumeSeed, setMessages, setConversation]);

  // Stick to the bottom as messages stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  // Auto-grow the textarea with its content (capped).
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Focus the input when opened; Escape closes.
  useEffect(() => {
    if (open && !historyOpen) taRef.current?.focus();
  }, [open, historyOpen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (historyOpen) setHistoryOpen(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, historyOpen]);

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
             <Image src="/logo.png" alt="ZenScail" width={32} height={32} />
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
            <button
              onClick={() => setHistoryOpen((h) => !h)}
              title="History"
              aria-label="Conversation history"
              aria-pressed={historyOpen}
              className={`rounded-lg p-1.5 transition hover:bg-(--bg-deep) hover:text-(--ink) ${
                historyOpen ? "text-(--accent)" : "text-(--muted)"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                <path d="M12 7v5l4 2" />
              </svg>
            </button>
            <button
              onClick={newConversation}
              title="New conversation"
              aria-label="New conversation"
              className="rounded-lg p-1.5 text-(--muted) transition hover:bg-(--bg-deep) hover:text-(--ink)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
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

        {historyOpen ? (
          <HistoryPanel
            conversations={conversations}
            activeId={convIdRef.current}
            onPick={loadConversation}
            onDelete={removeConversation}
          />
        ) : (
          <>
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
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "group flex flex-col"}>
                  <div
                    className={`min-w-0 max-w-[88%] overflow-hidden rounded-2xl px-4 py-3 text-sm wrap-anywhere ${
                      m.role === "user"
                        ? "self-end bg-(--ink) text-(--bg)"
                        : "border border-(--line-soft) bg-(--bg) text-(--ink-soft)"
                    }`}
                  >
                    {m.parts.map((part, i) => {
                      if (part.type === "text") {
                        return m.role === "user" ? (
                          <p key={i} className="whitespace-pre-wrap leading-relaxed wrap-anywhere">
                            {part.text}
                          </p>
                        ) : (
                          <Markdown key={i}>{part.text}</Markdown>
                        );
                      }
                      if (typeof part.type === "string" && part.type.startsWith("tool-") && ACTION_TOOLS.includes(part.type.slice(5))) {
                        const dir = directiveOf(part as { type: string; state?: string; output?: unknown });
                        if (dir) {
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setOpen(false); router.push(dir.url); }}
                              className="my-1 flex w-full items-center justify-between gap-2 rounded-xl border border-(--accent)/40 bg-(--accent-soft) px-3 py-2 text-left text-sm font-medium text-(--accent-deep) transition hover:border-(--accent)"
                            >
                              <span className="truncate">{dir.label} — review &amp; send</span>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M5 12h14M13 6l6 6-6 6" />
                              </svg>
                            </button>
                          );
                        }
                        return (
                          <div key={i} className="my-1 flex items-center gap-2 text-xs text-(--muted)">
                            <span className="text-(--accent)">⋯</span>
                            <span>Preparing it for you…</span>
                          </div>
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

                  {/* Assistant message actions: copy + like/dislike */}
                  {m.role === "assistant" && messageText(m) && (
                    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <MessageAction label="Copy" onClick={() => copyMessage(m)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </MessageAction>
                      <MessageAction
                        label="Good response"
                        active={feedback[m.id] === "up"}
                        onClick={() => rate(m.id, "up")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback[m.id] === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                        </svg>
                      </MessageAction>
                      <MessageAction
                        label="Bad response"
                        active={feedback[m.id] === "down"}
                        onClick={() => rate(m.id, "down")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback[m.id] === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
                        </svg>
                      </MessageAction>
                    </div>
                  )}
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
              className="flex items-end gap-2 border-t border-(--line-soft) bg-(--bg) p-3"
            >
              <textarea
                ref={taRef}
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy) send(input);
                  }
                }}
                placeholder="Ask anything…  (Shift+Enter for a new line)"
                className="min-w-0 flex-1 resize-none rounded-2xl border border-(--line) bg-(--paper) px-4 py-2.5 text-sm leading-relaxed text-(--ink) scrollbar-none placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft) [&::-webkit-scrollbar]:hidden"
              />
              <MicButton onText={(t) => { setInput((p) => (p ? `${p.trimEnd()} ` : "") + t); taRef.current?.focus(); }} onError={toast} disabled={busy} />
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
          </>
        )}
      </aside>
    </>
  );
}

function MessageAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-(--bg-deep) ${
        active ? "text-(--accent)" : "text-(--muted) hover:text-(--ink)"
      }`}
    >
      {children}
    </button>
  );
}

function HistoryPanel({
  conversations,
  activeId,
  onPick,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      <p className="px-1 pb-2 text-[11px] font-bold tracking-widest text-(--muted) uppercase">
        Recent conversations
      </p>
      {conversations.length === 0 ? (
        <p className="px-1 py-6 text-sm text-(--muted)">
          No conversations yet. Your chats will show up here.
        </p>
      ) : (
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li
              key={c.id}
              className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                c.id === activeId
                  ? "border-(--accent) bg-(--accent-soft)"
                  : "border-(--line-soft) bg-(--bg) hover:border-(--accent)"
              }`}
            >
              <button
                onClick={() => onPick(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-(--ink)">{c.title}</p>
                <p className="text-[11px] text-(--muted)">{timeAgo(c.updatedAt)}</p>
              </button>
              <button
                onClick={() => onDelete(c.id)}
                title="Delete conversation"
                aria-label="Delete conversation"
                className="shrink-0 rounded-lg p-1.5 text-(--muted) opacity-0 transition group-hover:opacity-100 hover:bg-(--paper) hover:text-(--accent)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
