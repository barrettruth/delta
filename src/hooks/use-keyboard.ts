"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/core/types";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";
import { isBrowserShortcut, isInputFocused } from "@/lib/utils";

const DELETE_KEY = getKeymap("queue.delete").triggerKey;
const PENDING_KEY = getKeymap("queue.set_pending").triggerKey;
const WIP_KEY = getKeymap("queue.set_wip").triggerKey;
const BLOCKED_KEY = getKeymap("queue.set_blocked").triggerKey;
const COMPLETE_KEY = getKeymap("queue.complete").triggerKey;

const STATUS_OPS: Record<string, TaskStatus> = {
  [PENDING_KEY]: "pending",
  [WIP_KEY]: "wip",
  [BLOCKED_KEY]: "blocked",
};

const OP_KEYS = new Set([
  DELETE_KEY,
  PENDING_KEY,
  WIP_KEY,
  BLOCKED_KEY,
  COMPLETE_KEY,
]);

const MOVE_DOWN_KEY = getKeymap("queue.move_down").triggerKey;
const MOVE_UP_KEY = getKeymap("queue.move_up").triggerKey;
const JUMP_BOTTOM_KEY = getKeymap("queue.jump_bottom").triggerKey;
const JUMP_TOP_KEY = getKeymap("queue.jump_top").triggerKey;
const EDIT_KEY = getKeymap("queue.edit").triggerKey;
const TOGGLE_SELECT_KEY = getKeymap("queue.toggle_select").triggerKey;
const VISUAL_MODE_KEY = getKeymap("queue.visual_mode").triggerKey;
const ESCAPE_KEY = getKeymap("queue.escape").triggerKey;
const G_PREFIX = JUMP_TOP_KEY[0];

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

function resolveMotion(
  key: string,
  cursor: number,
  taskCount: number,
  motionCount: number | null,
  preCount: number,
): [number, number] | null {
  if (key === MOVE_DOWN_KEY) {
    const n = preCount * (motionCount ?? 1);
    return [cursor, Math.min(cursor + n, taskCount - 1)];
  }
  if (key === MOVE_UP_KEY) {
    const n = preCount * (motionCount ?? 1);
    return [Math.max(cursor - n, 0), cursor];
  }
  if (key === JUMP_BOTTOM_KEY) {
    const target =
      motionCount != null
        ? Math.min(motionCount - 1, taskCount - 1)
        : taskCount - 1;
    return [Math.min(cursor, target), Math.max(cursor, target)];
  }
  if (key === JUMP_TOP_KEY) {
    const target =
      motionCount != null ? Math.min(motionCount - 1, taskCount - 1) : 0;
    return [Math.min(cursor, target), Math.max(cursor, target)];
  }
  return null;
}

export function useKeyboard(actions: KeyboardActions) {
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
    if (op === DELETE_KEY) {
      actionsRef.current.onDelete(ids);
    } else if (op === COMPLETE_KEY) {
      actionsRef.current.onComplete(ids);
    } else {
      const status = STATUS_OPS[op];
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

  const consumeCountRaw = useCallback((): number | null => {
    const s = countBuf.current;
    countBuf.current = "";
    if (!s) return null;
    return Number.parseInt(s, 10);
  }, []);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (isBrowserShortcut(e)) return;

      const { tasks, onSelect, onDeselect, onCreate } = actionsRef.current;
      const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);

      if (pendingOpMotionG.current && !isModifier) {
        const { op, motionCount } = pendingOpMotionG.current;
        pendingOpMotionG.current = null;
        if (opMotionGTimer.current) {
          clearTimeout(opMotionGTimer.current);
          opMotionGTimer.current = null;
        }
        if (e.key === G_PREFIX) {
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

        const motionCount = consumeCountRaw();
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

        if (e.key === G_PREFIX) {
          e.preventDefault();
          pendingOpMotionG.current = { op, preCount: pre, motionCount };
          opMotionGTimer.current = setTimeout(() => {
            pendingOpMotionG.current = null;
            opMotionGTimer.current = null;
          }, 500);
          return;
        }

        if (
          e.key === JUMP_BOTTOM_KEY ||
          e.key === MOVE_DOWN_KEY ||
          e.key === MOVE_UP_KEY
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

        if (e.key === ESCAPE_KEY) {
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
        if (e.key === G_PREFIX) {
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
        matchesEvent("queue.half_page_down", e) ||
        matchesEvent("queue.half_page_up", e)
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
        const delta =
          e.key === getKeymap("queue.half_page_down").key
            ? viewportRows
            : -viewportRows;
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

      if (OP_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey) {
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

      if (e.key === G_PREFIX && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pendingG.current = count;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 500);
      } else if (e.key === JUMP_BOTTOM_KEY) {
        e.preventDefault();
        if (tasks.length > 0) {
          actionsRef.current.onJump?.();
          setCursor(
            count !== null
              ? Math.max(0, Math.min(count - 1, tasks.length - 1))
              : tasks.length - 1,
          );
        }
      } else if (e.key === MOVE_DOWN_KEY) {
        e.preventDefault();
        if (tasks.length === 0) return;
        setCursor((i) => Math.min(i + n, tasks.length - 1));
      } else if (e.key === MOVE_UP_KEY) {
        e.preventDefault();
        if (tasks.length === 0) return;
        setCursor((i) => Math.max(i - n, 0));
      } else if (e.key === EDIT_KEY) {
        e.preventDefault();
        if (cursor >= 0 && cursor < tasks.length) {
          onSelect(tasks[cursor]);
        } else {
          onCreate?.();
        }
      } else if (e.key === TOGGLE_SELECT_KEY) {
        e.preventDefault();
        if (visualMode) {
          setVisualMode(false);
        }
        if (cursor >= 0 && cursor < tasks.length) {
          toggleSelect(tasks[cursor].id);
        }
      } else if (e.key === VISUAL_MODE_KEY) {
        e.preventDefault();
        if (visualMode) {
          setVisualMode(false);
          setSelectedIds(new Set());
        } else if (cursor >= 0) {
          setVisualMode(true);
          visualAnchor.current = cursor;
          setSelectedIds(new Set([tasks[cursor].id]));
        }
      } else if (e.key === ESCAPE_KEY) {
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
      consumeCountRaw,
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
