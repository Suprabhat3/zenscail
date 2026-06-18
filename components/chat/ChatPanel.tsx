"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Markdown } from "./Markdown";

function toolLabel(toolName: string): string {
  if (toolName.includes("send")) return "Sending email…";
  if (toolName.includes("events.create")) return "Creating event…";
  if (toolName.includes("events.update")) return "Updating event…";
  if (toolName.includes("delete") || toolName.includes("trash")) return "Deleting…";
  return `Working: ${toolName}`;
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-(--line-soft) bg-(--paper) px-5 py-5 shadow-(--shadow-card)">
            <p className="text-sm font-medium text-(--ink)">Ask anything about your mail and calendar.</p>
            <ul className="mt-3 space-y-2">
              {[
                "What are my most important unread emails?",
                "Send a calendar invite to friend@corsair.dev at 9 AM next Thursday.",
                "Reply to the latest email from my manager saying I'll be there.",
              ].map((prompt) => (
                <li key={prompt}>
                  <button
                    onClick={() => {
                      setInput(prompt);
                    }}
                    className="w-full rounded-xl border border-(--line-soft) bg-(--bg) px-4 py-2.5 text-left text-sm text-(--ink-soft) transition hover:border-(--line) hover:bg-(--bg-deep) hover:text-(--ink)"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div
              className={`min-w-0 max-w-[85%] overflow-hidden rounded-2xl px-4 py-3 text-sm [overflow-wrap:anywhere] ${
                m.role === "user"
                  ? "bg-(--ink) text-(--bg)"
                  : "border border-(--line-soft) bg-(--paper) text-(--ink-soft) shadow-(--shadow-card)"
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return m.role === "user" ? (
                    <p key={i} className="whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                      {part.text}
                    </p>
                  ) : (
                    <Markdown key={i}>{part.text}</Markdown>
                  );
                }
                if (part.type === "dynamic-tool") {
                  const done = part.state === "output-available";
                  return (
                    <div
                      key={i}
                      className="my-1 flex items-center gap-2 text-xs text-(--muted)"
                    >
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
            <div className="rounded-2xl border border-(--line-soft) bg-(--paper) px-4 py-3 text-sm text-(--muted)">
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
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
        className="flex gap-2 border-t border-(--line-soft) py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your mail or calendar…"
          className="flex-1 rounded-full border border-(--line) bg-(--paper) px-4 py-2.5 text-sm text-(--ink) placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-full bg-(--ink) px-5 py-2.5 text-sm font-semibold text-(--bg) transition hover:bg-(--accent) disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
