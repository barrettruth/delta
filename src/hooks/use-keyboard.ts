"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/core/types";

interface KeyboardActions {
  tasks: Task[];
  onComplete: (ids: number[]) => void;
  onDelete: (ids: number[]) => void;
  onCreate: () => void;
  onSelect: (task: Task) => void;
  onDeselect: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
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
  const visualAnchor = useRef(-1);

  const taskCount = actions.tasks.length;
  useEffect(() => {
    setCursor((prev) => (prev >= taskCount ? taskCount - 1 : prev));
  }, [taskCount]);

  useEffect(() => {
    if (!visualMode) return;
    const { tasks } = actions;
    setSelectedIds(rangeSet(tasks, visualAnchor.current, cursor));
  }, [cursor, visualMode, actions]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const { tasks, onComplete, onDelete, onCreate, onSelect, onDeselect } =
        actions;

      switch (e.key) {
        case "j": {
          e.preventDefault();
          setCursor((i) => Math.min(i + 1, tasks.length - 1));
          break;
        }
        case "k": {
          e.preventDefault();
          setCursor((i) => Math.max(i - 1, 0));
          break;
        }
        case "x": {
          e.preventDefault();
          if (selectedIds.size > 0) {
            onComplete([...selectedIds]);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else if (cursor >= 0 && cursor < tasks.length) {
            onComplete([tasks[cursor].id]);
          }
          break;
        }
        case "d": {
          e.preventDefault();
          if (selectedIds.size > 0) {
            onDelete([...selectedIds]);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else if (cursor >= 0 && cursor < tasks.length) {
            onDelete([tasks[cursor].id]);
          }
          break;
        }
        case "o": {
          e.preventDefault();
          onCreate();
          break;
        }
        case "Enter": {
          if (cursor >= 0 && cursor < tasks.length) {
            e.preventDefault();
            onSelect(tasks[cursor]);
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
    [actions, cursor, selectedIds, visualMode],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  function toggleSelect(taskId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return { cursor, setCursor, selectedIds, toggleSelect, visualMode };
}
