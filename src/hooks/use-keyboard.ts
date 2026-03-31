"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeymaps } from "@/contexts/keymaps";
import type { Task, TaskStatus } from "@/core/types";
import { isBrowserShortcut, isInputFocused } from "@/lib/utils";

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

function targetIds(tasks: Task[], cursor: number, count: number): number[] {
  const ids: number[] = [];
  for (let i = cursor; i < Math.min(cursor + count, tasks.length); i++) {
    if (i >= 0) ids.push(tasks[i].id);
  }
  return ids;
}

export function useKeyboard(actions: KeyboardActions) {
  const keymaps = useKeymaps();

  const keys = useMemo(() => {
    const deleteKey = keymaps.getResolvedKeymap("queue.delete").triggerKey;
    const pendingKey =
      keymaps.getResolvedKeymap("queue.set_pending").triggerKey;
    const wipKey = keymaps.getResolvedKeymap("queue.set_wip").triggerKey;
    const blockedKey =
      keymaps.getResolvedKeymap("queue.set_blocked").triggerKey;
    const completeKey = keymaps.getResolvedKeymap("queue.complete").triggerKey;
    const moveDownKey = keymaps.getResolvedKeymap("queue.move_down").triggerKey;
    const moveUpKey = keymaps.getResolvedKeymap("queue.move_up").triggerKey;
    const jumpBottomKey =
      keymaps.getResolvedKeymap("queue.jump_bottom").triggerKey;
    const jumpTopKey = keymaps.getResolvedKeymap("queue.jump_top").triggerKey;
    const editKey = keymaps.getResolvedKeymap("queue.edit").triggerKey;
    const toggleSelectKey = keymaps.getResolvedKeymap(
      "queue.toggle_select",
    ).triggerKey;
    const visualModeKey =
      keymaps.getResolvedKeymap("queue.visual_mode").triggerKey;
    const escapeKey = keymaps.getResolvedKeymap("queue.escape").triggerKey;
    const gPrefix = jumpTopKey[0];

    const statusOps: Record<string, TaskStatus> = {
      [pendingKey]: "pending",
      [wipKey]: "wip",
      [blockedKey]: "blocked",
    };

    const opKeys = new Set([
      deleteKey,
      pendingKey,
      wipKey,
      blockedKey,
      completeKey,
    ]);

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
      opKeys,
    };
  }, [keymaps]);

  const [cursor, setCursor] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visualMode, setVisualMode] = useState(false);
  const visualAnchor = useRef(-1);
  const countBuf = useRef("");
  const pendingG = useRef<number | null | false>(false);
  const pendingOp = useRef<{ key: string; preCount: number | null } | null>(
    null,
  );
  const pendingOpMotionG = useRef<{
    op: string;
    preCount: number;
    motionCount: number | null;
  } | null>(null);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opMotionGTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const consumeCount = useCallback((): number | null => {
    const s = countBuf.current;
    countBuf.current = "";
    if (!s) return null;
    return Number.parseInt(s, 10);
  }, []);

  const resolveMotion = useCallback(
    (
      key: string,
      cur: number,
      taskCnt: number,
      motionCount: number | null,
      preCount: number,
    ): [number, number] | null => {
      const k = keysRef.current;
      if (key === k.moveDownKey) {
        const n = preCount * (motionCount ?? 1);
        return [cur, Math.min(cur + n, taskCnt - 1)];
      }
      if (key === k.moveUpKey) {
        const n = preCount * (motionCount ?? 1);
        return [Math.max(cur - n, 0), cur];
      }
      if (key === k.jumpBottomKey) {
        const target =
          motionCount != null
            ? Math.min(motionCount - 1, taskCnt - 1)
            : taskCnt - 1;
        return [Math.min(cur, target), Math.max(cur, target)];
      }
      if (key === k.jumpTopKey) {
        const target =
          motionCount != null ? Math.min(motionCount - 1, taskCnt - 1) : 0;
        return [Math.min(cur, target), Math.max(cur, target)];
      }
      return null;
    },
    [],
  );

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (isBrowserShortcut(e)) return;

      const k = keysRef.current;
      const { tasks, onSelect, onDeselect, onCreate } = actionsRef.current;
      const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);

      if (pendingOpMotionG.current && !isModifier) {
        const { op, motionCount } = pendingOpMotionG.current;
        pendingOpMotionG.current = null;
        if (opMotionGTimer.current) {
          clearTimeout(opMotionGTimer.current);
          opMotionGTimer.current = null;
        }
        if (e.key === k.gPrefix) {
          e.preventDefault();
          const target =
            motionCount != null
              ? Math.min(motionCount - 1, tasks.length - 1)
              : 0;
          const lo = Math.min(target, cursor);
          const hi = Math.max(target, cursor);
          const ids: number[] = [];
          for (let i = lo; i <= hi && i < tasks.length; i++) {
            if (i >= 0) ids.push(tasks[i].id);
          }
          if (ids.length > 0) applyOp(op, ids);
        }
        countBuf.current = "";
        return;
      }

      if (pendingOp.current && !isModifier) {
        const { key: op, preCount } = pendingOp.current;

        if (
          (e.key >= "1" && e.key <= "9") ||
          (e.key === "0" && countBuf.current.length > 0)
        ) {
          e.preventDefault();
          countBuf.current += e.key;
          if (opTimer.current) {
            clearTimeout(opTimer.current);
          }
          opTimer.current = setTimeout(() => {
            pendingOp.current = null;
            opTimer.current = null;
            countBuf.current = "";
          }, 500);
          return;
        }

        const motionCount = consumeCount();
        pendingOp.current = null;
        if (opTimer.current) {
          clearTimeout(opTimer.current);
          opTimer.current = null;
        }

        const pre = preCount ?? 1;

        if (e.key === op) {
          e.preventDefault();
          if (cursor >= 0 && cursor < tasks.length) {
            applyOp(op, targetIds(tasks, cursor, pre));
          }
          return;
        }

        if (e.key === k.gPrefix) {
          e.preventDefault();
          pendingOpMotionG.current = { op, preCount: pre, motionCount };
          opMotionGTimer.current = setTimeout(() => {
            pendingOpMotionG.current = null;
            opMotionGTimer.current = null;
          }, 500);
          return;
        }

        if (
          e.key === k.jumpBottomKey ||
          e.key === k.moveDownKey ||
          e.key === k.moveUpKey
        ) {
          e.preventDefault();
          const range = resolveMotion(
            e.key,
            cursor,
            tasks.length,
            motionCount,
            pre,
          );
          if (range && cursor >= 0) {
            const [lo, hi] = range;
            const ids: number[] = [];
            for (let i = lo; i <= hi && i < tasks.length; i++) {
              if (i >= 0) ids.push(tasks[i].id);
            }
            if (ids.length > 0) applyOp(op, ids);
          }
          return;
        }

        if (e.key === k.escapeKey) {
          e.preventDefault();
          return;
        }

        return;
      }

      if (pendingG.current !== false && !isModifier) {
        const gCount = pendingG.current;
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (e.key === k.gPrefix) {
          e.preventDefault();
          if (tasks.length > 0) {
            actionsRef.current.onJump?.();
            setCursor(
              gCount !== null
                ? Math.max(0, Math.min(gCount - 1, tasks.length - 1))
                : 0,
            );
          }
          return;
        }
        if (e.key === "?") {
          e.preventDefault();
          actionsRef.current.onHelp?.();
          return;
        }
        return;
      }

      if (
        keymaps.resolvedMatchesEvent("queue.half_page_down", e) ||
        keymaps.resolvedMatchesEvent("queue.half_page_up", e)
      ) {
        e.preventDefault();
        countBuf.current = "";
        if (tasks.length === 0) return;
        const container = actionsRef.current.scrollRef?.current;
        const avgRowHeight =
          container && tasks.length > 0
            ? container.scrollHeight / tasks.length
            : 44;
        const viewportRows = container
          ? Math.max(1, Math.floor(container.clientHeight / avgRowHeight / 2))
          : 10;
        const hpDownKey = keymaps.getResolvedKeymap(
          "queue.half_page_down",
        ).triggerKey;
        const delta = e.key === hpDownKey ? viewportRows : -viewportRows;
        setCursor((i) => Math.max(0, Math.min(i + delta, tasks.length - 1)));
        return;
      }

      if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        countBuf.current += e.key;
        return;
      }
      if (
        e.key === "0" &&
        countBuf.current.length > 0 &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        countBuf.current += e.key;
        return;
      }

      const count = consumeCount();
      const n = count ?? 1;

      if (k.opKeys.has(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (tasks.length === 0) return;
        if (selectedIds.size > 0) {
          applyOp(e.key, [...selectedIds]);
        } else {
          pendingOp.current = { key: e.key, preCount: count };
          opTimer.current = setTimeout(() => {
            pendingOp.current = null;
            opTimer.current = null;
          }, 500);
        }
        return;
      }

      if (e.key === k.gPrefix && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pendingG.current = count;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 500);
      } else if (e.key === k.jumpBottomKey) {
        e.preventDefault();
        if (tasks.length > 0) {
          actionsRef.current.onJump?.();
          setCursor(
            count !== null
              ? Math.max(0, Math.min(count - 1, tasks.length - 1))
              : tasks.length - 1,
          );
        }
      } else if (e.key === k.moveDownKey) {
        e.preventDefault();
        if (tasks.length === 0) return;
        setCursor((i) => Math.min(i + n, tasks.length - 1));
      } else if (e.key === k.moveUpKey) {
        e.preventDefault();
        if (tasks.length === 0) return;
        setCursor((i) => Math.max(i - n, 0));
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
    [
      cursor,
      selectedIds,
      visualMode,
      toggleSelect,
      applyOp,
      consumeCount,
      resolveMotion,
      keymaps,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
      if (opTimer.current) clearTimeout(opTimer.current);
      if (opMotionGTimer.current) clearTimeout(opMotionGTimer.current);
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
