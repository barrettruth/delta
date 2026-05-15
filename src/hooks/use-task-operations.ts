"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import type { Task, TaskStatus } from "@/core/types";
import { startShortcutPerf } from "@/lib/shortcut-perf";
import {
  buildTaskMap,
  buildTaskUndoEntry,
  optimisticTaskForOperation,
  shouldPromptForRecurringDelete,
} from "@/lib/task-operations";
import {
  type RecurrenceDeleteController,
  useRecurrenceDelete,
} from "./use-recurrence-delete";

async function fetchTaskSnapshot(taskId: number): Promise<Task | null> {
  const response = await fetch(`/api/tasks/${taskId}`);
  if (!response.ok) return null;
  return response.json();
}

export interface TaskOperations {
  completeTasks: (taskIds: number[]) => void;
  deleteTasks: (taskIds: number[]) => void;
  changeTaskStatus: (taskIds: number[], status: TaskStatus) => void;
  moveTasksToStatus: (taskIds: number[], status: TaskStatus) => void;
  recurrenceDelete: RecurrenceDeleteController;
}

export function useTaskOperations<T extends Task>({
  tasks,
  closePanelOnDelete = true,
}: {
  tasks: T[];
  closePanelOnDelete?: boolean;
}): TaskOperations {
  const undo = useUndo();
  const panel = useTaskPanel();
  const statusBar = useStatusBar();
  const recurrenceDelete = useRecurrenceDelete();
  const taskById = useMemo(() => buildTaskMap(tasks), [tasks]);
  const mutationSeqRef = useRef(0);
  const latestMutationTokenByTaskRef = useRef(new Map<number, number>());

  const beginMutation = useCallback((taskId: number): number => {
    const token = mutationSeqRef.current + 1;
    mutationSeqRef.current = token;
    latestMutationTokenByTaskRef.current.set(taskId, token);
    return token;
  }, []);

  const isCurrentMutation = useCallback(
    (taskId: number, token: number): boolean =>
      latestMutationTokenByTaskRef.current.get(taskId) === token,
    [],
  );

  const mutableTaskIds = useCallback(
    (taskIds: number[]) => {
      const mutable: number[] = [];
      let readOnlyCount = 0;
      for (const taskId of taskIds) {
        const task = taskById.get(taskId);
        if (task?.sourceInfo?.readOnly) {
          readOnlyCount++;
        } else {
          mutable.push(taskId);
        }
      }
      if (readOnlyCount > 0) {
        statusBar.warning(
          readOnlyCount === 1
            ? "Imported provider task is read-only"
            : `${readOnlyCount} imported provider tasks are read-only`,
        );
      }
      return mutable;
    },
    [statusBar, taskById],
  );

  const reportActionError = useCallback(
    (result: { error: string } | { data: unknown } | undefined) => {
      if (!result || !("error" in result)) return;
      if (result.error.toLowerCase().includes("read-only")) {
        statusBar.warning(result.error);
      } else {
        statusBar.error(result.error);
      }
    },
    [statusBar],
  );

  const closePanelForDeletedTasks = useCallback(
    (taskIds: number[]) => {
      if (!closePanelOnDelete) return;
      if (panel.taskId != null && taskIds.includes(panel.taskId)) {
        panel.close();
      }
    },
    [closePanelOnDelete, panel],
  );

  const completeTasks = useCallback(
    (taskIds: number[]) => {
      taskIds = mutableTaskIds(taskIds);
      if (taskIds.length === 0) return;
      const metric = startShortcutPerf("task.complete");
      const entry = buildTaskUndoEntry({
        op: "complete",
        taskIds,
        tasks: taskById,
      });
      undo.push(entry);

      const completeOne = async (taskId: number, token: number) => {
        const previous = taskById.get(taskId);
        const result = await completeTaskAction(taskId, { revalidate: false });
        reportActionError(result);
        if (!isCurrentMutation(taskId, token)) return;
        const mutation = entry.mutations.find((m) => m.taskId === taskId);
        if (mutation && "data" in result) {
          mutation.spawnedTaskId = result.data.spawnedTaskId ?? undefined;
        }
        if ("data" in result) {
          panel.setOptimisticTask(result.data.task);
          if (result.data.spawnedTaskId) {
            const spawned = await fetchTaskSnapshot(result.data.spawnedTaskId);
            if (spawned && isCurrentMutation(taskId, token)) {
              panel.setOptimisticTask(spawned);
            }
          }
        } else if (previous) {
          panel.setOptimisticTask(previous);
        }
      };

      const tokens = new Map<number, number>();
      for (const taskId of taskIds) {
        const previous = taskById.get(taskId);
        tokens.set(taskId, beginMutation(taskId));
        if (previous) {
          panel.setOptimisticTask(
            optimisticTaskForOperation(previous, "complete"),
          );
        }
      }
      metric.markVisibleAfterFrame();
      void Promise.all(
        taskIds.map((taskId) => completeOne(taskId, tokens.get(taskId) ?? 0)),
      ).finally(() => {
        metric.markSettledAfterFrame();
      });
    },
    [
      beginMutation,
      isCurrentMutation,
      mutableTaskIds,
      panel,
      reportActionError,
      taskById,
      undo,
    ],
  );

  const deleteTasks = useCallback(
    (taskIds: number[]) => {
      taskIds = mutableTaskIds(taskIds);
      if (taskIds.length === 0) return;

      if (taskIds.length === 1) {
        const task = taskById.get(taskIds[0]);
        if (
          task &&
          shouldPromptForRecurringDelete(task) &&
          recurrenceDelete.requestDelete(task)
        ) {
          closePanelForDeletedTasks(taskIds);
          return;
        }
      }

      undo.push(
        buildTaskUndoEntry({
          op: "delete",
          taskIds,
          tasks: taskById,
        }),
      );

      const metric = startShortcutPerf("task.delete");
      const deleteOne = async (taskId: number, token: number) => {
        const previous = taskById.get(taskId);
        const result = await deleteTaskAction(taskId, { revalidate: false });
        reportActionError(result);
        if (!isCurrentMutation(taskId, token)) return;
        if ("data" in result) {
          panel.setOptimisticTask(result.data);
        } else if (previous) {
          panel.setOptimisticTask(previous);
        }
      };

      const tokens = new Map<number, number>();
      for (const taskId of taskIds) {
        const previous = taskById.get(taskId);
        tokens.set(taskId, beginMutation(taskId));
        if (previous) {
          panel.setOptimisticTask(
            optimisticTaskForOperation(previous, "delete"),
          );
        }
      }
      metric.markVisibleAfterFrame();
      void Promise.all(
        taskIds.map((taskId) => deleteOne(taskId, tokens.get(taskId) ?? 0)),
      ).finally(() => {
        metric.markSettledAfterFrame();
      });
      closePanelForDeletedTasks(taskIds);
    },
    [
      closePanelForDeletedTasks,
      mutableTaskIds,
      reportActionError,
      recurrenceDelete,
      taskById,
      undo,
      panel,
      beginMutation,
      isCurrentMutation,
    ],
  );

  const changeTaskStatus = useCallback(
    (taskIds: number[], status: TaskStatus) => {
      taskIds = mutableTaskIds(taskIds);
      if (taskIds.length === 0) return;
      undo.push(
        buildTaskUndoEntry({
          op: "status-change",
          taskIds,
          tasks: taskById,
          status,
        }),
      );

      const metric = startShortcutPerf("task.status", status);
      const updateOne = async (taskId: number, token: number) => {
        const previous = taskById.get(taskId);
        const result = await updateTaskAction(
          taskId,
          { status },
          { revalidate: false },
        );
        reportActionError(result);
        if (!isCurrentMutation(taskId, token)) return;
        if ("data" in result) {
          panel.setOptimisticTask(result.data);
        } else if (previous) {
          panel.setOptimisticTask(previous);
        }
      };

      const tokens = new Map<number, number>();
      for (const taskId of taskIds) {
        const previous = taskById.get(taskId);
        tokens.set(taskId, beginMutation(taskId));
        if (previous) {
          panel.setOptimisticTask(
            optimisticTaskForOperation(previous, "status-change", { status }),
          );
        }
      }
      metric.markVisibleAfterFrame();
      void Promise.all(
        taskIds.map((taskId) => updateOne(taskId, tokens.get(taskId) ?? 0)),
      ).finally(() => {
        metric.markSettledAfterFrame();
      });
    },
    [
      beginMutation,
      isCurrentMutation,
      mutableTaskIds,
      panel,
      reportActionError,
      taskById,
      undo,
    ],
  );

  const moveTasksToStatus = useCallback(
    (taskIds: number[], status: TaskStatus) => {
      if (status === "done") {
        completeTasks(taskIds);
        return;
      }
      changeTaskStatus(taskIds, status);
    },
    [changeTaskStatus, completeTasks],
  );

  return useMemo(
    () => ({
      completeTasks,
      deleteTasks,
      changeTaskStatus,
      moveTasksToStatus,
      recurrenceDelete,
    }),
    [
      changeTaskStatus,
      completeTasks,
      deleteTasks,
      moveTasksToStatus,
      recurrenceDelete,
    ],
  );
}
