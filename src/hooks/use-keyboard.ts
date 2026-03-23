"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";
import type { Task } from "@/core/types";

interface KeyboardActions {
  tasks: Task[];
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
  onSelect: (task: Task) => void;
  onDeselect: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
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

export function useKeyboard(actions: KeyboardActions) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const taskCount = actions.tasks.length;
  useEffect(() => {
    setSelectedIndex((prev) => (prev >= taskCount ? -1 : prev));
  }, [taskCount]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        actions.searchRef?.current?.focus();
        return;
      }

      if (isInputFocused()) return;

      const { tasks, onComplete, onDelete, onCreate, onSelect, onDeselect } =
        actions;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, tasks.length - 1));
          break;
        case "k":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "x":
          if (selectedIndex >= 0 && selectedIndex < tasks.length) {
            onComplete(tasks[selectedIndex].id);
          }
          break;
        case "d":
          if (selectedIndex >= 0 && selectedIndex < tasks.length) {
            onDelete(tasks[selectedIndex].id);
          }
          break;
        case "o":
          e.preventDefault();
          onCreate();
          break;
        case "Enter":
          if (selectedIndex >= 0 && selectedIndex < tasks.length) {
            e.preventDefault();
            onSelect(tasks[selectedIndex]);
          }
          break;
        case "Escape":
          setSelectedIndex(-1);
          onDeselect();
          break;
      }
    },
    [actions, selectedIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  return { selectedIndex, setSelectedIndex };
}
