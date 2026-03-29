"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type PrimaryType = "message" | "error" | "undo";

interface StatusBarState {
  primary: string;
  primaryType: PrimaryType;
  operation: string;
  idleLeft: string;
  idleRight: string;
}

interface StatusBarContextValue {
  state: StatusBarState;
  message: (text: string, duration?: number) => void;
  error: (text: string, duration?: number) => void;
  undo: (text: string, duration?: number) => void;
  setOperation: (label: string) => void;
  clearOperation: () => void;
  setIdle: (left: string, right: string) => void;
}

const StatusBarContext = createContext<StatusBarContextValue | null>(null);

const DEFAULT_MESSAGE_DURATION = 3000;
const DEFAULT_ERROR_DURATION = 5000;
const UNDO_DURATION = 10000;

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StatusBarState>({
    primary: "",
    primaryType: "message",
    operation: "",
    idleLeft: "",
    idleRight: "",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setPrimaryWithTimer = useCallback(
    (text: string, type: PrimaryType, duration: number) => {
      clearTimer();
      setState((prev) => ({ ...prev, primary: text, primaryType: type }));
      timerRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, primary: "", primaryType: "message" }));
        timerRef.current = null;
      }, duration);
    },
    [clearTimer],
  );

  const message = useCallback(
    (text: string, duration?: number) => {
      setPrimaryWithTimer(
        text,
        "message",
        duration ?? DEFAULT_MESSAGE_DURATION,
      );
    },
    [setPrimaryWithTimer],
  );

  const error = useCallback(
    (text: string, duration?: number) => {
      setPrimaryWithTimer(text, "error", duration ?? DEFAULT_ERROR_DURATION);
    },
    [setPrimaryWithTimer],
  );

  const undo = useCallback(
    (text: string, duration?: number) => {
      setPrimaryWithTimer(text, "undo", duration ?? UNDO_DURATION);
    },
    [setPrimaryWithTimer],
  );

  const setOperation = useCallback((label: string) => {
    setState((prev) => ({ ...prev, operation: label }));
  }, []);

  const clearOperation = useCallback(() => {
    setState((prev) => ({ ...prev, operation: "" }));
  }, []);

  const setIdle = useCallback((left: string, right: string) => {
    setState((prev) => ({ ...prev, idleLeft: left, idleRight: right }));
  }, []);

  const value: StatusBarContextValue = {
    state,
    message,
    error,
    undo,
    setOperation,
    clearOperation,
    setIdle,
  };

  return (
    <StatusBarContext.Provider value={value}>
      {children}
    </StatusBarContext.Provider>
  );
}

export { UNDO_DURATION };

export function useStatusBar(): StatusBarContextValue {
  const ctx = useContext(StatusBarContext);
  if (!ctx) {
    throw new Error("useStatusBar must be used within StatusBarProvider");
  }
  return ctx;
}
