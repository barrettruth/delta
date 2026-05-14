"use client";

import { useCallback, useMemo } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import type { Task, TaskStatus } from "@/core/types";
import {
  buildTaskMap,
  buildTaskUndoEntry,
  shouldPromptForRecurringDelete,
} from "@/lib/task-operations";
import {
  type RecurrenceDeleteController,
  useRecurrenceDelete,
} from "./use-recurrence-delete";

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
      const entry = buildTaskUndoEntry({
        op: "complete",
        taskIds,
        tasks: taskById,
      });
      undo.push(entry);

      for (const taskId of taskIds) {
        void completeTaskAction(taskId).then((result) => {
          reportActionError(result);
          const mutation = entry.mutations.find((m) => m.taskId === taskId);
          if (mutation && result && "data" in result) {
            mutation.spawnedTaskId = result.data?.spawnedTaskId ?? undefined;
          }
        });
      }
    },
    [mutableTaskIds, reportActionError, taskById, undo],
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

      for (const taskId of taskIds) {
        void deleteTaskAction(taskId).then(reportActionError);
      }
      closePanelForDeletedTasks(taskIds);
    },
    [
      closePanelForDeletedTasks,
      mutableTaskIds,
      reportActionError,
      recurrenceDelete,
      taskById,
      undo,
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

      for (const taskId of taskIds) {
        void updateTaskAction(taskId, { status }).then(reportActionError);
      }
    },
    [mutableTaskIds, reportActionError, taskById, undo],
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
