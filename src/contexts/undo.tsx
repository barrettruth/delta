"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UndoEntry } from "@/core/undo";
import { undoTaskAction, undoCompleteTaskAction } from "@/app/actions/tasks";

interface PendingOp {
  action: () => Promise<void>;
  timeout: ReturnType<typeof setTimeout>;
}

interface UndoContextValue {
  push: (entry: UndoEntry) => void;
  scheduleExecution: (
    id: string,
    action: () => Promise<void>,
    delayMs?: number,
  ) => void;
  undo: () => Promise<void>;
  flushPending: () => void;
  canUndo: boolean;
  message: string | null;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_UNDO_STACK = 50;
const DEFAULT_DELAY_MS = 5000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<UndoEntry[]>([]);
  const pendingOps = useRef<Map<string, PendingOp>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((msg: string, durationMs: number) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setMessage(msg);
    clearTimer.current = setTimeout(() => {
      setMessage(null);
      clearTimer.current = null;
    }, durationMs);
  }, []);

  const scheduleExecution = useCallback(
    (id: string, action: () => Promise<void>, delayMs?: number) => {
      const existing = pendingOps.current.get(id);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      const timeout = setTimeout(
        () => {
          pendingOps.current.delete(id);
          action();
        },
        delayMs ?? DEFAULT_DELAY_MS,
      );
      pendingOps.current.set(id, { action, timeout });
    },
    [],
  );

  const push = useCallback(
    (entry: UndoEntry) => {
      const stack = stackRef.current;
      stack.push(entry);
      if (stack.length > MAX_UNDO_STACK) {
        stack.shift();
      }
      setCanUndo(true);
      showMessage(`${entry.label} — press u to undo`, DEFAULT_DELAY_MS);
    },
    [showMessage],
  );

  const executeUndo = useCallback(
    async (entry: UndoEntry) => {
      if (entry.op === "complete") {
        await undoCompleteTaskAction(
          entry.mutations.map((m) => ({
            taskId: m.taskId,
            status: m.restore.status,
            completedAt: m.restore.completedAt,
            spawnedTaskId: m.spawnedTaskId,
          })),
        );
      } else {
        await undoTaskAction(
          entry.mutations.map((m) => ({
            taskId: m.taskId,
            status: m.restore.status,
            completedAt: m.restore.completedAt,
          })),
        );
      }
    },
    [],
  );

  const undo = useCallback(async () => {
    const stack = stackRef.current;
    const entry = stack.pop();
    if (!entry) return;

    setCanUndo(stack.length > 0);

    const pending = pendingOps.current.get(entry.id);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingOps.current.delete(entry.id);
      showMessage(`Cancelled: ${entry.label}`, 3000);
    } else {
      await executeUndo(entry);
      showMessage(`\u21a9 ${entry.label}`, 3000);
    }
  }, [executeUndo, showMessage]);

  const flushPending = useCallback(() => {
    for (const [, { action, timeout }] of pendingOps.current) {
      clearTimeout(timeout);
      action();
    }
    pendingOps.current.clear();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPending();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushPending();
    };
  }, [flushPending]);

  const value: UndoContextValue = {
    push,
    scheduleExecution,
    undo,
    flushPending,
    canUndo,
    message,
  };

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    throw new Error("useUndo must be used within UndoProvider");
  }
  return ctx;
}
