"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { DEFAULT_KEYMAPS, type KeymapDef } from "@/lib/keymap-defs";

const keymapIndex = new Map(DEFAULT_KEYMAPS.map((d) => [d.id, d]));

interface KeymapContextValue {
  overrides: Record<string, string>;
  getResolvedKeymap(id: string): KeymapDef;
  resolvedMatchesEvent(id: string, e: KeyboardEvent): boolean;
  setOverride(id: string, triggerKey: string): Promise<void>;
  resetOverride(id: string): Promise<void>;
  resetAll(): Promise<void>;
}

const KeymapContext = createContext<KeymapContextValue | null>(null);

async function persistOverrides(
  overrides: Record<string, string>,
): Promise<void> {
  await fetch("/api/settings/keymaps", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
}

export function KeymapProvider({
  initialOverrides,
  children,
}: {
  initialOverrides: Record<string, string>;
  children: ReactNode;
}) {
  const [overrides, setOverrides] = useState(initialOverrides);

  const getResolvedKeymap = useCallback(
    (id: string): KeymapDef => {
      const def = keymapIndex.get(id);
      if (!def) throw new Error(`Unknown keymap id: ${id}`);
      const override = overrides[id];
      if (override) {
        return { ...def, triggerKey: override };
      }
      return def;
    },
    [overrides],
  );

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

  const setOverride = useCallback(
    async (id: string, triggerKey: string): Promise<void> => {
      const next = { ...overrides, [id]: triggerKey };
      setOverrides(next);
      await persistOverrides(next);
    },
    [overrides],
  );

  const resetOverride = useCallback(
    async (id: string): Promise<void> => {
      const next = { ...overrides };
      delete next[id];
      setOverrides(next);
      await persistOverrides(next);
    },
    [overrides],
  );

  const resetAll = useCallback(async (): Promise<void> => {
    setOverrides({});
    await persistOverrides({});
  }, []);

  const value: KeymapContextValue = {
    overrides,
    getResolvedKeymap,
    resolvedMatchesEvent,
    setOverride,
    resetOverride,
    resetAll,
  };

  return (
    <KeymapContext.Provider value={value}>{children}</KeymapContext.Provider>
  );
}

export function useKeymaps(): KeymapContextValue {
  const ctx = useContext(KeymapContext);
  if (!ctx) {
    throw new Error("useKeymaps must be used within KeymapProvider");
  }
  return ctx;
}
