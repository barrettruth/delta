"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type MessageType = "message" | "error" | "undo";

interface StatusBarMessage {
  text: string;
  type: MessageType;
  id: number;
}

interface OperationState {
  text: string;
}

interface StatusBarContextValue {
  current: StatusBarMessage | null;
  operation: OperationState | null;
  message: (text: string) => void;
  error: (text: string) => void;
  undo: (text: string) => void;
  setOperation: (text: string) => void;
  clearOperation: () => void;
}

const StatusBarContext = createContext<StatusBarContextValue | null>(null);

const MESSAGE_DURATION = 3000;
const ERROR_DURATION = 5000;

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<StatusBarMessage | null>(null);
  const [operation, setOperationState] = useState<OperationState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const show = useCallback((text: string, type: MessageType) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = ++idRef.current;
    setCurrent({ text, type, id });
    const duration = type === "error" ? ERROR_DURATION : MESSAGE_DURATION;
    timerRef.current = setTimeout(() => {
      setCurrent((prev) => (prev?.id === id ? null : prev));
      timerRef.current = null;
    }, duration);
  }, []);

  const message = useCallback((text: string) => show(text, "message"), [show]);
  const error = useCallback((text: string) => show(text, "error"), [show]);
  const undoMsg = useCallback((text: string) => show(text, "undo"), [show]);

  const setOperation = useCallback((text: string) => {
    setOperationState({ text });
  }, []);

  const clearOperation = useCallback(() => {
    setOperationState(null);
  }, []);

  return (
    <StatusBarContext.Provider
      value={{
        current,
        operation,
        message,
        error,
        undo: undoMsg,
        setOperation,
        clearOperation,
      }}
    >
      {children}
    </StatusBarContext.Provider>
  );
}

export function useStatusBar(): StatusBarContextValue {
  const ctx = useContext(StatusBarContext);
  if (!ctx) {
    throw new Error("useStatusBar must be used within StatusBarProvider");
  }
  return ctx;
}
