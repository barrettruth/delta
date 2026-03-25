"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/core/types";
import { isInputFocused } from "@/lib/utils";

const STATUS_OPS: Record<string, TaskStatus> = {
  p: "pending",
  w: "wip",
  b: "blocked",
};

const OP_KEYS = new Set(["d", "p", "w", "b"]);

interface KeyboardActions {
  tasks: Task[];
  onComplete: (ids: number[]) => void;
  onDelete: (ids: number[]) => void;
  onStatusChange: (ids: number[], status: TaskStatus) => void;
  onSelect: (task: Task) => void;
  onDeselect: () => void;
  onHelp?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

function rangeSet(tasks: Task[], a: number, b: number): Set<number> {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const ids = new Set<number>();
  for (let i = lo; i <= hi; i++) {
    if (i >= 0 && i < tasks.length) ids.add(tasks[i].id);
  }
  return ids;
}

export function useKeyboard(actions: KeyboardActions) {
  const [cursor, setCursor] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visualMode, setVisualMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number[] | null>(null);
  const visualAnchor = useRef(-1);
  const pendingG = useRef(false);
  const pendingOp = useRef<string | null>(null);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const taskCount = actions.tasks.length;
  useEffect(() => {
    setCursor((prev) => (prev >= taskCount ? taskCount - 1 : prev));
  }, [taskCount]);

  useEffect(() => {
    if (!visualMode) return;
    const { tasks } = actionsRef.current;
    setSelectedIds(rangeSet(tasks, visualAnchor.current, cursor));
  }, [cursor, visualMode]);

  const toggleSelect = useCallback((taskId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const applyOp = useCallback((op: string, ids: number[]) => {
    if (ids.length === 0) return;
    if (op === "d") {
      setPendingDelete(ids);
    } else {
      const status = STATUS_OPS[op];
      if (status) actionsRef.current.onStatusChange(ids, status);
    }
    setSelectedIds(new Set());
    setVisualMode(false);
  }, []);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (pendingDelete) {
        e.preventDefault();
        if (e.key === "y") {
          actionsRef.current.onDelete(pendingDelete);
          setSelectedIds(new Set());
          setVisualMode(false);
        }
        setPendingDelete(null);
        return;
      }

      const { tasks, onComplete, onSelect, onDeselect } = actionsRef.current;

      const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);

      if (pendingOp.current && !isModifier) {
        const op = pendingOp.current;
        pendingOp.current = null;
        if (opTimer.current) {
          clearTimeout(opTimer.current);
          opTimer.current = null;
        }
        if (e.key === op) {
          e.preventDefault();
          if (cursor >= 0 && cursor < tasks.length) {
            applyOp(op, [tasks[cursor].id]);
          }
        }
        return;
      }

      if (pendingG.current && !isModifier) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (e.key === "g") {
          e.preventDefault();
          if (tasks.length > 0) setCursor(0);
          return;
        }
        if (e.key === "?") {
          e.preventDefault();
          actionsRef.current.onHelp?.();
          return;
        }
        return;
      }

      if (e.ctrlKey && (e.key === "d" || e.key === "u")) {
        e.preventDefault();
        if (tasks.length === 0) return;
        const container = actionsRef.current.scrollRef?.current;
        const rowHeight = 44;
        const viewportRows = container
          ? Math.max(1, Math.floor(container.clientHeight / rowHeight / 2))
          : 10;
        const delta = e.key === "d" ? viewportRows : -viewportRows;
        setCursor((i) => Math.max(0, Math.min(i + delta, tasks.length - 1)));
        return;
      }

      if (OP_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (tasks.length === 0) return;
        if (selectedIds.size > 0) {
          applyOp(e.key, [...selectedIds]);
        } else {
          pendingOp.current = e.key;
          opTimer.current = setTimeout(() => {
            pendingOp.current = null;
            opTimer.current = null;
          }, 500);
        }
        return;
      }

      switch (e.key) {
        case "g": {
          e.preventDefault();
          pendingG.current = true;
          gTimer.current = setTimeout(() => {
            pendingG.current = false;
            gTimer.current = null;
          }, 500);
          break;
        }
        case "G": {
          e.preventDefault();
          if (tasks.length > 0) setCursor(tasks.length - 1);
          break;
        }
        case "j": {
          e.preventDefault();
          if (tasks.length === 0) break;
          setCursor((i) => Math.min(i + 1, tasks.length - 1));
          break;
        }
        case "k": {
          e.preventDefault();
          if (tasks.length === 0) break;
          setCursor((i) => Math.max(i - 1, 0));
          break;
        }
        case "x": {
          e.preventDefault();
          if (tasks.length === 0) break;
          if (selectedIds.size > 0) {
            onComplete([...selectedIds]);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else if (cursor >= 0 && cursor < tasks.length) {
            onComplete([tasks[cursor].id]);
          }
          break;
        }
        case "Enter": {
          if (tasks.length === 0) break;
          if (cursor >= 0 && cursor < tasks.length) {
            e.preventDefault();
            onSelect(tasks[cursor]);
          }
          break;
        }
        case "v": {
          e.preventDefault();
          if (visualMode) {
            setVisualMode(false);
          }
          if (cursor >= 0 && cursor < tasks.length) {
            toggleSelect(tasks[cursor].id);
          }
          break;
        }
        case "V": {
          e.preventDefault();
          if (visualMode) {
            setVisualMode(false);
            setSelectedIds(new Set());
          } else if (cursor >= 0) {
            setVisualMode(true);
            visualAnchor.current = cursor;
            setSelectedIds(new Set([tasks[cursor].id]));
          }
          break;
        }
        case "Escape": {
          if (visualMode) {
            setVisualMode(false);
            setSelectedIds(new Set());
          } else if (selectedIds.size > 0) {
            setSelectedIds(new Set());
          } else {
            setCursor(-1);
            onDeselect();
          }
          break;
        }
      }
    },
    [cursor, selectedIds, visualMode, pendingDelete, toggleSelect, applyOp],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
      if (opTimer.current) clearTimeout(opTimer.current);
    };
  }, []);

  return {
    cursor,
    setCursor,
    selectedIds,
    toggleSelect,
    visualMode,
    pendingDelete,
  };
}
