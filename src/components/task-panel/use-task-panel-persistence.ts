"use client";

import { useCallback, useEffect, useRef } from "react";
import { createTaskAction, saveTaskDetailsAction } from "@/app/actions/tasks";
import { readOnlyImportMessage } from "@/components/task-source-indicator";
import type { Task } from "@/core/types";
import type { TaskPreFill } from "@/lib/calendar-utils";
import {
  buildTaskPanelUpdateInput,
  createTaskPanelSaveQueue,
  isTaskPanelDirty,
  type TaskPanelFormValues,
} from "@/lib/task-panel-save";

type TaskPanelMode = "edit" | "create";

interface StatusMessenger {
  error: (message: string) => void;
  warning: (message: string) => void;
}

export interface TaskPanelPersistenceController {
  clearAutoSaveTimer: () => void;
  closePanel: () => Promise<void>;
  createTask: () => Promise<void>;
  discardPendingSave: () => void;
  saveTask: (id: number) => Promise<boolean>;
  setInitialSnapshot: (form: TaskPanelFormValues) => void;
}

export function useTaskPanelPersistence({
  isOpen,
  mode,
  task,
  taskId,
  preFill,
  currentFormValues,
  getCurrentFormValues,
  forceClose,
  statusBar,
}: {
  isOpen: boolean;
  mode: TaskPanelMode;
  task: Task | null;
  taskId: number | null;
  preFill: TaskPreFill | null;
  currentFormValues: TaskPanelFormValues;
  getCurrentFormValues: () => TaskPanelFormValues;
  forceClose: () => void;
  statusBar: StatusMessenger;
}): TaskPanelPersistenceController {
  const initialDueRef = useRef("");
  const initialFormRef = useRef<TaskPanelFormValues | null>(null);
  const saveQueueRef = useRef(createTaskPanelSaveQueue());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTaskIdRef = useRef<number | null>(null);

  const setInitialSnapshot = useCallback((form: TaskPanelFormValues) => {
    initialFormRef.current = form;
    initialDueRef.current = form.due;
  }, []);

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const saveTask = useCallback(
    (id: number) => {
      const snapshot = {
        form: getCurrentFormValues(),
        initialDue: initialDueRef.current,
      };

      return saveQueueRef.current.enqueue(async () => {
        if (!isTaskPanelDirty(initialFormRef.current, snapshot.form)) {
          return true;
        }

        if (task?.sourceInfo?.readOnly) {
          statusBar.warning(readOnlyImportMessage(task.sourceInfo));
          return false;
        }

        let taskInput: ReturnType<typeof buildTaskPanelUpdateInput>;
        try {
          taskInput = buildTaskPanelUpdateInput(
            snapshot.form,
            snapshot.initialDue,
          );
        } catch (error) {
          statusBar.error(
            error instanceof Error
              ? error.message
              : "Failed to save task details",
          );
          return false;
        }

        const result = await saveTaskDetailsAction(id, { task: taskInput });

        if ("error" in result) {
          statusBar.error(result.error);
          return false;
        }

        initialFormRef.current = snapshot.form;
        initialDueRef.current = snapshot.form.due;

        return true;
      });
    },
    [getCurrentFormValues, statusBar, task],
  );

  useEffect(() => {
    const prevId = prevTaskIdRef.current;
    if (prevId && prevId !== taskId) {
      void saveTask(prevId);
    }
    prevTaskIdRef.current = taskId;
  }, [saveTask, taskId]);

  useEffect(() => {
    if (!isOpen || mode !== "edit" || !task) {
      clearAutoSaveTimer();
      return;
    }

    if (currentFormValues.description.trim().length === 0) {
      clearAutoSaveTimer();
      return;
    }

    if (!isTaskPanelDirty(initialFormRef.current, currentFormValues)) {
      clearAutoSaveTimer();
      return;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void saveTask(task.id);
    }, 750);

    return clearAutoSaveTimer;
  }, [clearAutoSaveTimer, currentFormValues, isOpen, mode, saveTask, task]);

  const createTask = useCallback(async () => {
    const snapshot = getCurrentFormValues();
    const trimmed = snapshot.description.trim();
    if (!trimmed) return;

    const result = await createTaskAction({
      description: trimmed,
      category: snapshot.category || undefined,
      due: snapshot.due ? new Date(snapshot.due).toISOString() : undefined,
      notes: snapshot.notes || undefined,
      location: snapshot.location || undefined,
      locationLat:
        snapshot.location && snapshot.locationLat != null
          ? snapshot.locationLat
          : undefined,
      locationLon:
        snapshot.location && snapshot.locationLon != null
          ? snapshot.locationLon
          : undefined,
      meetingUrl: snapshot.meetingUrl || undefined,
      startAt: preFill?.startAt,
      endAt: preFill?.endAt,
      allDay: preFill?.allDay,
      timezone: preFill?.timezone,
      recurrence: snapshot.recurrence || undefined,
      recurMode: snapshot.recurrence ? snapshot.recurMode : undefined,
    });

    if ("data" in result && result.data) {
      forceClose();
      return;
    }

    if ("error" in result) {
      statusBar.error(result.error);
    }
  }, [forceClose, getCurrentFormValues, preFill, statusBar]);

  const closePanel = useCallback(async () => {
    clearAutoSaveTimer();

    if (mode === "edit" && task) {
      if (await saveTask(task.id)) {
        forceClose();
      }
      return;
    }

    if (mode === "create") {
      if (getCurrentFormValues().description.trim()) {
        await createTask();
      } else {
        forceClose();
      }
    }
  }, [
    clearAutoSaveTimer,
    createTask,
    forceClose,
    getCurrentFormValues,
    mode,
    saveTask,
    task,
  ]);

  const discardPendingSave = useCallback(() => {
    prevTaskIdRef.current = null;
    clearAutoSaveTimer();
  }, [clearAutoSaveTimer]);

  return {
    clearAutoSaveTimer,
    closePanel,
    createTask,
    discardPendingSave,
    saveTask,
    setInitialSnapshot,
  };
}
