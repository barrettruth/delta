"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "delta:command-history";
const MAX_HISTORY = 100;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

interface CommandBarContextValue {
  active: boolean;
  input: string;
  history: string[];
  historyIndex: number;
  activate: () => void;
  deactivate: () => void;
  setInput: (value: string) => void;
  pushHistory: (cmd: string) => void;
  navigateHistory: (direction: "up" | "down") => void;
}

const CommandBarContext = createContext<CommandBarContextValue | null>(null);

export function CommandBarProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<string[]>(loadHistory());
  const [, forceRender] = useState(0);
  const savedInputRef = useRef("");

  const activate = useCallback(() => {
    setActive(true);
    setInput("");
    setHistoryIndex(-1);
    savedInputRef.current = "";
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setInput("");
    setHistoryIndex(-1);
  }, []);

  const pushHistory = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    const h = historyRef.current;
    const idx = h.indexOf(trimmed);
    if (idx !== -1) h.splice(idx, 1);
    h.push(trimmed);
    if (h.length > MAX_HISTORY) h.shift();
    saveHistory(h);
    forceRender((n) => n + 1);
  }, []);

  const navigateHistory = useCallback(
    (direction: "up" | "down") => {
      const h = historyRef.current;
      if (h.length === 0) return;

      setHistoryIndex((prev) => {
        if (direction === "up") {
          if (prev === -1) {
            savedInputRef.current = input;
          }
          const next = prev === -1 ? h.length - 1 : Math.max(0, prev - 1);
          setInput(h[next]);
          return next;
        }
        if (prev === -1) return -1;
        const next = prev + 1;
        if (next >= h.length) {
          setInput(savedInputRef.current);
          return -1;
        }
        setInput(h[next]);
        return next;
      });
    },
    [input],
  );

  return (
    <CommandBarContext.Provider
      value={{
        active,
        input,
        history: historyRef.current,
        historyIndex,
        activate,
        deactivate,
        setInput,
        pushHistory,
        navigateHistory,
      }}
    >
      {children}
    </CommandBarContext.Provider>
  );
}

export function useCommandBar(): CommandBarContextValue {
  const ctx = useContext(CommandBarContext);
  if (!ctx) {
    throw new Error("useCommandBar must be used within CommandBarProvider");
  }
  return ctx;
}
