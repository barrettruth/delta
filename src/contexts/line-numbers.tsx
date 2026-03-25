"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type LineNumberMode = "none" | "nu" | "rnu";

const STORAGE_KEY = "delta:line-number-mode";
const CYCLE: LineNumberMode[] = ["none", "nu", "rnu"];

interface LineNumberContextValue {
  mode: LineNumberMode;
  cycleMode: () => void;
  getLineNumber: (index: number, cursorIndex: number) => string | null;
}

const LineNumberContext = createContext<LineNumberContextValue>({
  mode: "none",
  cycleMode: () => {},
  getLineNumber: () => null,
});

export function LineNumberProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<LineNumberMode>("none");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CYCLE.includes(stored as LineNumberMode)) {
      setMode(stored as LineNumberMode);
    }
  }, []);

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      const next = CYCLE[(CYCLE.indexOf(prev) + 1) % CYCLE.length];
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const getLineNumber = useCallback(
    (index: number, cursorIndex: number): string | null => {
      if (mode === "none") return null;
      if (mode === "nu") return String(index + 1);
      const cur = cursorIndex < 0 ? 0 : cursorIndex;
      if (index === cur) return String(index + 1);
      return String(Math.abs(index - cur));
    },
    [mode],
  );

  return (
    <LineNumberContext value={{ mode, cycleMode, getLineNumber }}>
      {children}
    </LineNumberContext>
  );
}

export function useLineNumbers() {
  return useContext(LineNumberContext);
}
