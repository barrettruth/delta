"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UndoEntry } from "@/core/undo";
import { undoTaskAction, undoCompleteTaskAction } from "@/app/actions/tasks";

interface UndoContextValue {
  push: (entry: UndoEntry) => void;
  undo: () => Promise<void>;
  canUndo: boolean;
  message: string | null;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_UNDO_STACK = 50;

export function UndoProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((entry: UndoEntry) => {
    const stack = stackRef.current;
    stack.push(entry);
    if (stack.length > MAX_UNDO_STACK) {
      stack.shift();
    }
    setCanUndo(true);
  }, []);

  const undo = useCallback(async () => {
    const stack = stackRef.current;
    const entry = stack.pop();
    if (!entry) return;

    setCanUndo(stack.length > 0);

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

    if (clearTimer.current) clearTimeout(clearTimer.current);
    setMessage(`↩ ${entry.label}`);
    clearTimer.current = setTimeout(() => {
      setMessage(null);
      clearTimer.current = null;
    }, 3000);
  }, []);

  const value: UndoContextValue = { push, undo, canUndo, message };

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    throw new Error("useUndo must be used within UndoProvider");
  }
  return ctx;
}
