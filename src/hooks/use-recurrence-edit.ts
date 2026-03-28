"use client";

import { useCallback, useState } from "react";
import {
  editAllInstancesAction,
  editRecurringInstanceAction,
  editThisAndFutureAction,
} from "@/app/actions/tasks";
import type { RecurrenceStrategy } from "@/components/recurrence-strategy-dialog";
import type { UpdateTaskInput } from "@/core/types";

interface PendingEdit {
  masterId: number;
  instanceDate: string;
  updates: UpdateTaskInput;
}

export function useRecurrenceEdit() {
  const [pending, setPending] = useState<PendingEdit | null>(null);

  const requestEdit = useCallback(
    (masterId: number, instanceDate: string, updates: UpdateTaskInput) => {
      setPending({ masterId, instanceDate, updates });
    },
    [],
  );

  const executeStrategy = useCallback(
    async (strategy: RecurrenceStrategy) => {
      if (!pending) return;
      const { masterId, instanceDate, updates } = pending;
      setPending(null);

      if (strategy === "this") {
        await editRecurringInstanceAction(masterId, instanceDate, updates);
      } else if (strategy === "this-and-future") {
        await editThisAndFutureAction(masterId, instanceDate, updates);
      } else if (strategy === "all") {
        await editAllInstancesAction(masterId, updates);
      }
    },
    [pending],
  );

  const cancel = useCallback(() => {
    setPending(null);
  }, []);

  return {
    pending,
    requestEdit,
    executeStrategy,
    cancel,
  };
}
