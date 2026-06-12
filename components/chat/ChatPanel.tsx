"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

function toolLabel(toolName: string): string {
  // MCP tool names are dotted Corsair paths, e.g. gmail.api.messages.send
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
      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="px-1 text-sm text-neutral-500">
            <p>Ask anything about your mail and calendar. Try:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>“What are my most important unread emails?”</li>
              <li>“Send a calendar invite to friend@corsair.dev at 9 AM next Thursday.”</li>
              <li>“Reply to the latest email from my manager saying I'll be there.”</li>
            </ul>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-neutral-100 text-neutral-950"
                  : "border border-neutral-800 bg-neutral-900 text-neutral-200"
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                if (part.type === "dynamic-tool") {
                  const done = part.state === "output-available";
                  return (
                    <div
                      key={i}
                      className="my-1 flex items-center gap-2 text-xs text-neutral-400"
                    >
                      <span>{done ? "✓" : "⋯"}</span>
                      <span>{done ? `Done: ${part.toolName}` : toolLabel(part.toolName)}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {busy && <div className="px-1 text-sm text-neutral-500">Thinking…</div>}
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error.message || "Something went wrong."}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
        className="flex gap-2 border-t border-neutral-800 py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your mail or calendar…"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
