"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { Task } from "@/core/types";
import type { TaskPreFill } from "@/lib/calendar-utils";

type PanelMode = "edit" | "create";

interface TaskPanelContextValue {
  isOpen: boolean;
  mode: PanelMode;
  taskId: number | null;
  preFill: TaskPreFill | null;
  width: number;
  pendingEdits: Map<number, Partial<Task>>;
  open: (taskId: number) => void;
  create: (preFill?: TaskPreFill) => void;
  close: () => void;
  toggle: (taskId: number) => void;
  setWidth: (w: number) => void;
  setPendingEdit: (taskId: number, fields: Partial<Task>) => void;
  clearPendingEdit: (taskId: number) => void;
}

const TaskPanelContext = createContext<TaskPanelContextValue | null>(null);

const WIDTH_KEY = "delta:panel-width";
const DEFAULT_WIDTH = 50;
export const MIN_WIDTH_PCT = 20;
export const MAX_WIDTH_PCT = 60;

export function TaskPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("edit");
  const [taskId, setTaskId] = useState<number | null>(null);
  const [preFill, setPreFill] = useState<TaskPreFill | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Map<number, Partial<Task>>>(
    () => new Map(),
  );

  const [width, setWidthState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    try {
      const stored = localStorage.getItem(WIDTH_KEY);
      if (stored) {
        const n = Number(stored);
        if (n >= MIN_WIDTH_PCT && n <= MAX_WIDTH_PCT) return n;
      }
    } catch {}
    return DEFAULT_WIDTH;
  });

  const isOpenRef = useRef(false);
  const taskIdRef = useRef<number | null>(null);
  isOpenRef.current = isOpen;
  taskIdRef.current = taskId;

  const open = useCallback((id: number) => {
    setTaskId(id);
    setMode("edit");
    setPreFill(null);
    setIsOpen(true);
  }, []);

  const create = useCallback((pf?: TaskPreFill) => {
    setTaskId(null);
    setMode("create");
    setPreFill(pf ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    const id = taskIdRef.current;
    if (id !== null) {
      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
    setIsOpen(false);
    setTaskId(null);
    setPreFill(null);
  }, []);

  const toggle = useCallback((id: number) => {
    if (isOpenRef.current && taskIdRef.current === id) {
      setIsOpen(false);
    } else {
      setTaskId(id);
      setMode("edit");
      setPreFill(null);
      setIsOpen(true);
    }
  }, []);

  const setWidth = useCallback((w: number) => {
    const clamped = Math.max(MIN_WIDTH_PCT, Math.min(MAX_WIDTH_PCT, w));
    setWidthState(clamped);
    try {
      localStorage.setItem(WIDTH_KEY, String(clamped));
    } catch {}
  }, []);

  const setPendingEdit = useCallback((id: number, fields: Partial<Task>) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(prev.get(id) ?? {}), ...fields });
      return next;
    });
  }, []);

  const clearPendingEdit = useCallback((id: number) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return (
    <TaskPanelContext.Provider
      value={{
        isOpen,
        mode,
        taskId,
        preFill,
        width,
        pendingEdits,
        open,
        create,
        close,
        toggle,
        setWidth,
        setPendingEdit,
        clearPendingEdit,
      }}
    >
      {children}
    </TaskPanelContext.Provider>
  );
}

export function useTaskPanel() {
  const ctx = useContext(TaskPanelContext);
  if (!ctx)
    throw new Error("useTaskPanel must be used within TaskPanelProvider");
  return ctx;
}
