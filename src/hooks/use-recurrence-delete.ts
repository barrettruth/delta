"use client";

import { useCallback, useMemo, useState } from "react";
import {
  deleteAllInstancesAction,
  deleteTaskAction,
  deleteThisAndFutureAction,
  deleteThisInstanceAction,
} from "@/app/actions/tasks";
import type { RecurrenceStrategy } from "@/components/recurrence-strategy-dialog";
import type { Task } from "@/core/types";

interface PendingDelete {
  task: Task;
}

export interface RecurrenceDeleteController {
  pending: PendingDelete | null;
  requestDelete: (task: Task) => boolean;
  executeStrategy: (strategy: RecurrenceStrategy) => Promise<void>;
  cancel: () => void;
}

export function useRecurrenceDelete(): RecurrenceDeleteController {
  const [pending, setPending] = useState<PendingDelete | null>(null);

  const requestDelete = useCallback((task: Task): boolean => {
    if (task.recurrence || task.recurringTaskId) {
      setPending({ task });
      return true;
    }
    return false;
  }, []);

  const executeStrategy = useCallback(
    async (strategy: RecurrenceStrategy) => {
      if (!pending) return;
      const { task } = pending;
      setPending(null);

      if (strategy === "this") {
        if (task.recurringTaskId) {
          await deleteTaskAction(task.id);
        } else {
          await deleteThisInstanceAction(
            task.id,
            task.startAt ?? task.due ?? new Date().toISOString(),
          );
        }
      } else if (strategy === "this-and-future") {
        const masterId = task.recurringTaskId ?? task.id;
        const instanceDate =
          task.originalStartAt ??
          task.startAt ??
          task.due ??
          new Date().toISOString();
        await deleteThisAndFutureAction(masterId, instanceDate);
      } else if (strategy === "all") {
        const masterId = task.recurringTaskId ?? task.id;
        await deleteAllInstancesAction(masterId);
      }
    },
    [pending],
  );

  const cancel = useCallback(() => {
    setPending(null);
  }, []);

  return useMemo(
    () => ({
      pending,
      requestDelete,
      executeStrategy,
      cancel,
    }),
    [pending, requestDelete, executeStrategy, cancel],
  );
}
