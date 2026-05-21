"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/core/types";
import { registerScopedKeydown } from "@/lib/keyboard";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";

interface KeyboardActions {
  tasks: Task[];
  onComplete: (ids: number[]) => void;
  onDelete: (ids: number[]) => void;
  onStatusChange: (ids: number[], status: TaskStatus) => void;
  onSelect: (task: Task) => void;
  onDeselect: () => void;
  onCreate?: () => void;
  onHelp?: () => void;
  onJump?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  taskPanelOpen?: boolean;
}

export type QueuePendingLeaderAction = "jump-top" | "help" | "create" | null;

export function resolveQueuePendingLeaderAction(
  key: string,
  gPrefix: string,
): QueuePendingLeaderAction {
  if (key === gPrefix) return "jump-top";
  if (key === "?") return "help";
  if (key === "c") return "create";
  return null;
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
  const keys = useMemo(() => {
    const deleteKey = getKeymap("queue.delete").triggerKey;
    const pendingKey = getKeymap("queue.set_pending").triggerKey;
    const wipKey = getKeymap("queue.set_wip").triggerKey;
    const blockedKey = getKeymap("queue.set_blocked").triggerKey;
    const completeKey = getKeymap("queue.complete").triggerKey;
    const moveDownKey = getKeymap("queue.move_down").triggerKey;
    const moveUpKey = getKeymap("queue.move_up").triggerKey;
    const jumpBottomKey = getKeymap("queue.jump_bottom").triggerKey;
    const jumpTopKey = getKeymap("queue.jump_top").triggerKey;
    const editKey = getKeymap("queue.edit").triggerKey;
    const toggleSelectKey = getKeymap("queue.toggle_select").triggerKey;
    const visualModeKey = getKeymap("queue.visual_mode").triggerKey;
    const escapeKey = getKeymap("queue.escape").triggerKey;
    const gPrefix = jumpTopKey[0];

    const statusOps: Record<string, TaskStatus> = {
      [pendingKey]: "pending",
      [wipKey]: "wip",
      [blockedKey]: "blocked",
    };

    return {
      deleteKey,
      completeKey,
      moveDownKey,
      moveUpKey,
      jumpBottomKey,
      jumpTopKey,
      editKey,
      toggleSelectKey,
      visualModeKey,
      escapeKey,
      gPrefix,
      statusOps,
    };
  }, []);

  const [cursor, setCursor] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visualMode, setVisualMode] = useState(false);
  const visualAnchor = useRef(-1);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const keysRef = useRef(keys);
  keysRef.current = keys;

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
    const k = keysRef.current;
    if (op === k.deleteKey) {
      actionsRef.current.onDelete(ids);
    } else if (op === k.completeKey) {
      actionsRef.current.onComplete(ids);
    } else {
      const status = k.statusOps[op];
      if (status) actionsRef.current.onStatusChange(ids, status);
    }
    setSelectedIds(new Set());
    setVisualMode(false);
  }, []);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const k = keysRef.current;
      const { tasks, onSelect, onDeselect, onCreate } = actionsRef.current;

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        const leaderAction = resolveQueuePendingLeaderAction(e.key, k.gPrefix);
        if (leaderAction === "jump-top") {
          e.preventDefault();
          if (tasks.length > 0) {
            actionsRef.current.onJump?.();
            setCursor(0);
          }
          return;
        }
        if (leaderAction === "help") {
          e.preventDefault();
          actionsRef.current.onHelp?.();
          return;
        }
        if (leaderAction === "create") {
          e.preventDefault();
          onCreate?.();
          return;
        }
        return;
      }

      if (
        matchesEvent("queue.half_page_down", e) ||
        matchesEvent("queue.half_page_up", e)
      ) {
        e.preventDefault();
        if (tasks.length === 0) return;
        const container = actionsRef.current.scrollRef?.current;
        const avgRowHeight =
          container && tasks.length > 0
            ? container.scrollHeight / tasks.length
            : 44;
        const viewportRows = container
          ? Math.max(1, Math.floor(container.clientHeight / avgRowHeight / 2))
          : 10;
        const hpDownKey = getKeymap("queue.half_page_down").triggerKey;
        const delta = e.key === hpDownKey ? viewportRows : -viewportRows;
        setCursor((i) => Math.max(0, Math.min(i + delta, tasks.length - 1)));
        return;
      }

      const applyToSelectionOrCursor = (op: string) => {
        if (selectedIds.size > 0) {
          applyOp(op, [...selectedIds]);
        } else if (cursor >= 0 && cursor < tasks.length) {
          applyOp(op, [tasks[cursor].id]);
        }
      };

      if (e.key === k.deleteKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        applyToSelectionOrCursor(e.key);
      } else if (e.key === k.completeKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        applyToSelectionOrCursor(e.key);
      } else if (k.statusOps[e.key] && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        applyToSelectionOrCursor(e.key);
      } else if (e.key === k.gPrefix && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 500);
      } else if (e.key === k.jumpBottomKey) {
        e.preventDefault();
        if (tasks.length > 0) {
          actionsRef.current.onJump?.();
          setCursor(tasks.length - 1);
        }
      } else if (e.key === k.moveDownKey) {
        e.preventDefault();
        if (tasks.length === 0) return;
        setCursor((i) => Math.min(i + 1, tasks.length - 1));
      } else if (e.key === k.moveUpKey) {
        e.preventDefault();
        if (tasks.length === 0) return;
        setCursor((i) => Math.max(i - 1, 0));
      } else if (e.key === k.editKey) {
        e.preventDefault();
        if (cursor >= 0 && cursor < tasks.length) {
          onSelect(tasks[cursor]);
        } else {
          onCreate?.();
        }
      } else if (e.key === k.toggleSelectKey) {
        e.preventDefault();
        if (visualMode) {
          setVisualMode(false);
        }
        if (cursor >= 0 && cursor < tasks.length) {
          toggleSelect(tasks[cursor].id);
        }
      } else if (e.key === k.visualModeKey) {
        e.preventDefault();
        if (visualMode) {
          setVisualMode(false);
          setSelectedIds(new Set());
        } else if (cursor >= 0) {
          setVisualMode(true);
          visualAnchor.current = cursor;
          setSelectedIds(new Set([tasks[cursor].id]));
        }
      } else if (e.key === k.escapeKey) {
        if (visualMode) {
          setVisualMode(false);
          setSelectedIds(new Set());
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        } else {
          setCursor(-1);
          onDeselect();
        }
      }
    },
    [cursor, selectedIds, visualMode, toggleSelect, applyOp],
  );

  useEffect(() => {
    return registerScopedKeydown(
      window,
      () => ({
        scope: "view",
        taskPanelOpen: actionsRef.current.taskPanelOpen,
      }),
      handler,
    );
  }, [handler]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return {
    cursor,
    setCursor,
    selectedIds,
    toggleSelect,
    visualMode,
  };
}
