"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import {
  TaskPanelFrame,
  TaskPanelHeader,
} from "@/components/task-panel/panel-chrome";
import {
  TaskPanelFields,
  TaskPanelNotes,
} from "@/components/task-panel/task-panel-fields";
import {
  taskPanelFormValuesFromPrefill,
  taskPanelFormValuesFromTask,
  useTaskPanelForm,
} from "@/components/task-panel/use-task-panel-form";
import { useTaskPanelPersistence } from "@/components/task-panel/use-task-panel-persistence";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import type { Task, TaskStatus } from "@/core/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { shouldHandleKeyboardEvent } from "@/lib/keyboard";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";

export function TaskPanel({
  tasks,
  variant = "sidebar",
}: {
  tasks: Task[];
  variant?: "sidebar" | "popover";
}) {
  const panel = useTaskPanel();
  const nav = useNavigation();
  const statusBar = useStatusBar();
  const recurrenceDelete = useRecurrenceDelete();
  const undo = useUndo();
  const {
    isOpen,
    mode,
    taskId,
    preFill,
    width,
    closeRequestSeq,
    optimisticTasks,
    setPendingEdit,
    clearPendingEdit,
    clearOptimisticTask,
    forceClose,
  } = panel;

  const task = useMemo(
    () =>
      taskId
        ? (tasks.find((candidate) => candidate.id === taskId) ??
          optimisticTasks.get(taskId) ??
          null)
        : null,
    [tasks, taskId, optimisticTasks],
  );

  useEffect(() => {
    if (taskId == null) return;
    if (!optimisticTasks.has(taskId)) return;
    if (tasks.some((candidate) => candidate.id === taskId)) {
      clearOptimisticTask(taskId);
    }
  }, [tasks, taskId, optimisticTasks, clearOptimisticTask]);

  const form = useTaskPanelForm({ tasks, statusBar });
  const {
    clearAutoSaveTimer,
    closePanel,
    createTask,
    discardPendingSave,
    saveTask,
    setInitialSnapshot,
  } = useTaskPanelPersistence({
    isOpen,
    mode,
    task,
    taskId,
    preFill,
    currentFormValues: form.values,
    getCurrentFormValues: form.getCurrentFormValues,
    forceClose,
    statusBar,
  });

  const handledCloseRequestRef = useRef(0);

  const { category, description, location, meetingUrl } = form.values;

  // Wait for the active task to hydrate before exposing optimistic field edits;
  // otherwise a just-materialized recurring instance can inherit stale fields.
  useEffect(() => {
    if (mode !== "edit" || !taskId || !task) return;
    setPendingEdit(taskId, {
      description,
      category: category || null,
      location: location || null,
      meetingUrl: meetingUrl || null,
    } as Partial<Task>);
  }, [
    mode,
    taskId,
    task,
    description,
    category,
    location,
    meetingUrl,
    setPendingEdit,
  ]);

  useEffect(() => {
    return () => {
      if (taskId) clearPendingEdit(taskId);
    };
  }, [taskId, clearPendingEdit]);

  useEffect(() => {
    if (mode === "edit" && task) {
      const nextForm = taskPanelFormValuesFromTask(task);
      setInitialSnapshot(nextForm);
      form.reset(nextForm);
    } else if (mode === "create") {
      const nextForm = taskPanelFormValuesFromPrefill(preFill);
      setInitialSnapshot(nextForm);
      form.reset(nextForm);
    }
  }, [mode, preFill, task, form.reset, setInitialSnapshot]);

  useEffect(() => {
    void taskId;
    if (isOpen) {
      requestAnimationFrame(() => form.titleRef.current?.focus());
    }
  }, [isOpen, taskId, form.titleRef]);

  useEffect(() => {
    if (isOpen && taskId) {
      nav.setTaskDetailOpen(taskId);
    } else if (!isOpen) {
      nav.setTaskDetailOpen(null);
    }
  }, [isOpen, taskId, nav]);

  const handleStatusChange = useCallback(
    async (status: string) => {
      if (!task) return;
      if (status === "done") {
        await completeTaskAction(task.id);
      } else {
        await updateTaskAction(task.id, { status: status as TaskStatus });
      }
    },
    [task],
  );

  const handleDelete = useCallback(() => {
    if (!task) return;
    if (
      (task.recurrence || task.recurringTaskId) &&
      recurrenceDelete.requestDelete(task)
    ) {
      forceClose();
      return;
    }
    undo.push({
      id: `delete-${Date.now()}-${task.id}`,
      op: "delete",
      label: "1 task deleted",
      mutations: [
        {
          taskId: task.id,
          restore: {
            status: (task.status as TaskStatus) ?? "pending",
            completedAt: task.completedAt ?? null,
          },
        },
      ],
      timestamp: Date.now(),
    });
    discardPendingSave();
    void deleteTaskAction(task.id);
    forceClose();
  }, [discardPendingSave, forceClose, recurrenceDelete, task, undo]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        !shouldHandleKeyboardEvent(event.nativeEvent, {
          scope: "task-panel",
          ignoreInputFocus: false,
        })
      ) {
        return;
      }

      if (matchesEvent("task_detail.save", event.nativeEvent)) {
        event.preventDefault();
        clearAutoSaveTimer();
        if (mode === "edit" && task) {
          void saveTask(task.id);
        } else if (mode === "create") {
          void createTask();
        }
        return;
      }

      const closeKey = getKeymap("task_detail.close").triggerKey;
      if (event.key === closeKey) {
        event.preventDefault();
        event.stopPropagation();
        void closePanel();
        return;
      }

      const createKey = getKeymap("task_detail.create").triggerKey;
      if (
        mode === "create" &&
        event.key === createKey &&
        !event.shiftKey &&
        event.target === form.titleRef.current
      ) {
        event.preventDefault();
        void createTask();
      }
    },
    [
      clearAutoSaveTimer,
      closePanel,
      createTask,
      form.titleRef,
      mode,
      saveTask,
      task,
    ],
  );

  useEffect(() => {
    if (isOpen && mode === "edit" && !task) {
      forceClose();
    }
  }, [isOpen, mode, task, forceClose]);

  useEffect(() => {
    if (!isOpen) {
      handledCloseRequestRef.current = closeRequestSeq;
      return;
    }
    if (closeRequestSeq === handledCloseRequestRef.current) return;
    handledCloseRequestRef.current = closeRequestSeq;
    void closePanel();
  }, [closePanel, closeRequestSeq, isOpen]);

  const isMobile = useIsMobile();

  if (!isOpen) return null;
  if (mode === "edit" && !task) return null;

  return (
    <>
      <TaskPanelFrame
        isMobile={isMobile}
        onKeyDown={handleKeyDown}
        onResize={panel.setWidth}
        variant={variant}
        width={width}
      >
        <TaskPanelHeader
          description={description}
          isMobile={isMobile}
          mode={mode}
          onClose={() => void closePanel()}
          onDelete={handleDelete}
          onDescriptionChange={form.setDescription}
          task={task}
          titleRef={form.titleRef}
        />

        <TaskPanelFields
          form={form}
          mode={mode}
          onStatusChange={(status) => void handleStatusChange(status)}
          preFill={preFill}
          task={task}
        />

        <TaskPanelNotes form={form} mode={mode} task={task} />
      </TaskPanelFrame>

      <RecurrenceStrategyDialog
        open={!!recurrenceDelete.pending}
        onOpenChange={(open) => {
          if (!open) recurrenceDelete.cancel();
        }}
        mode="delete"
        onSelect={(strategy) => {
          void recurrenceDelete.executeStrategy(strategy);
          forceClose();
        }}
      />
    </>
  );
}
