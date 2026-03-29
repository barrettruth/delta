"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { undoCompleteTaskAction, undoTaskAction } from "@/app/actions/tasks";
import { useStatusBar } from "@/contexts/status-bar";
import type { UndoEntry } from "@/core/undo";

interface UndoContextValue {
  push: (entry: UndoEntry) => void;
  undo: () => Promise<void>;
  canUndo: boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_UNDO_STACK = 50;

export function UndoProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const statusBar = useStatusBar();

  const push = useCallback(
    (entry: UndoEntry) => {
      const stack = stackRef.current;
      stack.push(entry);
      if (stack.length > MAX_UNDO_STACK) {
        stack.shift();
      }
      setCanUndo(true);
      statusBar.undo(entry.label);
    },
    [statusBar],
  );

  const executeUndo = useCallback(async (entry: UndoEntry) => {
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
  }, []);

  const undo = useCallback(async () => {
    const stack = stackRef.current;
    const entry = stack.pop();
    if (!entry) return;

    setCanUndo(stack.length > 0);
    await executeUndo(entry);
  }, [executeUndo]);

  const value: UndoContextValue = {
    push,
    undo,
    canUndo,
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
