"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ChatContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Prompt queued by another part of the UI (e.g. "Ask about this brief"). */
  seed: string | null;
  /** Open the dock and queue a prompt to send. */
  openWith: (prompt: string) => void;
  consumeSeed: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const openWith = useCallback((prompt: string) => {
    setSeed(prompt);
    setOpen(true);
  }, []);
  const consumeSeed = useCallback(() => setSeed(null), []);

  const value = useMemo(
    () => ({ open, setOpen, toggle, seed, openWith, consumeSeed }),
    [open, toggle, seed, openWith, consumeSeed],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatDock(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatDock must be used inside <ChatProvider>");
  return ctx;
}
