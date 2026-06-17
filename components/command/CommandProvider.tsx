"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type CommandContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  const value = useMemo(
    () => ({ open, setOpen, toggle }),
    [open, toggle],
  );

  return (
    <CommandContext.Provider value={value}>{children}</CommandContext.Provider>
  );
}

export function useCommandPalette(): CommandContextValue {
  const ctx = useContext(CommandContext);
  if (!ctx)
    throw new Error("useCommandPalette must be used inside <CommandProvider>");
  return ctx;
}
