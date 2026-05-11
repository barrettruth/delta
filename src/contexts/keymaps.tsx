"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";
import { DEFAULT_KEYMAPS, type KeymapDef } from "@/lib/keymap-defs";

const keymapIndex = new Map(DEFAULT_KEYMAPS.map((d) => [d.id, d]));

interface KeymapContextValue {
  getResolvedKeymap(id: string): KeymapDef;
  resolvedMatchesEvent(id: string, e: KeyboardEvent): boolean;
}

const KeymapContext = createContext<KeymapContextValue | null>(null);

export function KeymapProvider({ children }: { children: ReactNode }) {
  const getResolvedKeymap = useCallback((id: string): KeymapDef => {
    const def = keymapIndex.get(id);
    if (!def) throw new Error(`Unknown keymap id: ${id}`);
    return def;
  }, []);

  const resolvedMatchesEvent = useCallback(
    (id: string, e: KeyboardEvent): boolean => {
      const resolved = getResolvedKeymap(id);
      if (e.key !== resolved.triggerKey) return false;
      const wantCtrlOrMeta =
        (resolved.modifiers?.includes("ctrl") ?? false) ||
        (resolved.modifiers?.includes("meta") ?? false);
      const wantShift = resolved.modifiers?.includes("shift") ?? false;
      const wantAlt = resolved.modifiers?.includes("alt") ?? false;
      return (
        (e.ctrlKey || e.metaKey) === wantCtrlOrMeta &&
        e.shiftKey === wantShift &&
        e.altKey === wantAlt
      );
    },
    [getResolvedKeymap],
  );

  return (
    <KeymapContext.Provider value={{ getResolvedKeymap, resolvedMatchesEvent }}>
      {children}
    </KeymapContext.Provider>
  );
}

export function useKeymaps(): KeymapContextValue {
  const ctx = useContext(KeymapContext);
  if (!ctx) {
    throw new Error("useKeymaps must be used within KeymapProvider");
  }
  return ctx;
}
