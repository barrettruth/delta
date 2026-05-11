"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";

interface KeyboardHelpContextValue {
  openKeyboardHelp: () => void;
}

const KeyboardHelpContext = createContext<KeyboardHelpContextValue | null>(
  null,
);

export function KeyboardHelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openKeyboardHelp = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openKeyboardHelp }), [openKeyboardHelp]);

  return (
    <KeyboardHelpContext.Provider value={value}>
      {children}
      <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} />
    </KeyboardHelpContext.Provider>
  );
}

export function useKeyboardHelp(): KeyboardHelpContextValue {
  const ctx = useContext(KeyboardHelpContext);
  if (!ctx) {
    throw new Error("useKeyboardHelp must be used within KeyboardHelpProvider");
  }
  return ctx;
}
