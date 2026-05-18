"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/core/types";
import {
  hasAllDayEventInRange,
  type OptimisticUpdate,
  tasksToEvents,
  type VirtualMeta,
} from "@/lib/fullcalendar-adapter";
import {
  addOptimisticMasterExdate,
  mergeOptimisticCalendarTasks,
  pruneOptimisticMasterExdates,
} from "./calendar-view-model";

export function useCalendarEvents({
  categoryColors,
  isTimeGridView,
  optimisticTasks,
  pendingEdits,
  rangeEnd,
  rangeStart,
  tasks,
}: {
  categoryColors: Record<string, string>;
  isTimeGridView: boolean;
  optimisticTasks: Map<number, Task>;
  pendingEdits: Map<number, Partial<Task>>;
  rangeEnd: Date;
  rangeStart: Date;
  tasks: Task[];
}) {
  const [allDayVisible, setAllDayVisible] = useState(true);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<number, OptimisticUpdate>
  >(new Map());
  const [optimisticMasterExdates, setOptimisticMasterExdates] = useState<
    Map<number, string[]>
  >(new Map());
  const virtualMetaRef = useRef(new Map<number, VirtualMeta>());
  const prevTasksRef = useRef(tasks);

  useEffect(() => {
    if (prevTasksRef.current !== tasks) {
      if (optimisticUpdates.size > 0) setOptimisticUpdates(new Map());
      if (optimisticMasterExdates.size > 0) {
        setOptimisticMasterExdates((prev) =>
          pruneOptimisticMasterExdates(prev, tasks),
        );
      }
    }
    prevTasksRef.current = tasks;
  }, [tasks, optimisticUpdates.size, optimisticMasterExdates.size]);

  const effectiveTasks = useMemo(
    () =>
      mergeOptimisticCalendarTasks(
        tasks,
        optimisticTasks,
        optimisticMasterExdates,
      ),
    [tasks, optimisticTasks, optimisticMasterExdates],
  );

  const { events, virtualMeta } = useMemo(() => {
    return tasksToEvents(effectiveTasks, {
      pendingEdits,
      optimisticUpdates,
      categoryColors,
      rangeStart,
      rangeEnd,
    });
  }, [
    effectiveTasks,
    pendingEdits,
    optimisticUpdates,
    categoryColors,
    rangeStart,
    rangeEnd,
  ]);

  virtualMetaRef.current = virtualMeta;

  const hasVisibleAllDayEvents = useMemo(() => {
    if (!isTimeGridView) return true;
    return hasAllDayEventInRange(events, rangeStart, rangeEnd);
  }, [events, isTimeGridView, rangeStart, rangeEnd]);

  useEffect(() => {
    if (isTimeGridView && !hasVisibleAllDayEvents && !allDayVisible) {
      setAllDayVisible(true);
    }
  }, [allDayVisible, hasVisibleAllDayEvents, isTimeGridView]);

  const allDaySlotVisible = isTimeGridView
    ? allDayVisible && hasVisibleAllDayEvents
    : true;

  const pushOptimistic = useCallback((id: number, update: OptimisticUpdate) => {
    setOptimisticUpdates((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) ?? {}), ...update });
      return next;
    });
  }, []);

  const clearOptimisticUpdate = useCallback((id: number) => {
    setOptimisticUpdates((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const addMasterExdate = useCallback((masterId: number, exdateIso: string) => {
    setOptimisticMasterExdates((prev) =>
      addOptimisticMasterExdate(prev, masterId, exdateIso),
    );
  }, []);

  return {
    addMasterExdate,
    allDaySlotVisible,
    clearOptimisticUpdate,
    events,
    hasVisibleAllDayEvents,
    pushOptimistic,
    setAllDayVisible,
    virtualMetaRef,
  };
}
