import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "@/core/types";
import {
  buildTaskMap,
  buildTaskUndoEntry,
  mergeOptimisticTasks,
  optimisticTaskForOperation,
  shouldPromptForRecurringDelete,
} from "@/lib/task-operations";

type Snapshot = {
  id: number;
  status: TaskStatus;
  completedAt: string | null;
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    userId: 1,
    description: "one",
    status: "pending",
    category: "Todo",
    due: null,
    recurrence: null,
    recurMode: null,
    notes: null,
    order: 0,
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    startAt: null,
    endAt: null,
    allDay: 0,
    timezone: null,
    completedAt: null,
    location: null,
    locationLat: null,
    locationLon: null,
    meetingUrl: null,
    exdates: null,
    rdates: null,
    recurringTaskId: null,
    originalStartAt: null,
    ...overrides,
  };
}

describe("task operation helpers", () => {
  it("builds undo entries from the original task state", () => {
    const tasks = buildTaskMap<Snapshot>([
      { id: 1, status: "wip", completedAt: null },
      { id: 2, status: "done", completedAt: "2026-05-11T12:00:00.000Z" },
    ]);

    const entry = buildTaskUndoEntry({
      op: "delete",
      taskIds: [1, 2],
      tasks,
      timestamp: 123,
    });

    expect(entry).toEqual({
      id: "delete-123-1,2",
      op: "delete",
      label: "2 tasks deleted",
      timestamp: 123,
      mutations: [
        {
          taskId: 1,
          restore: { status: "wip", completedAt: null },
        },
        {
          taskId: 2,
          restore: {
            status: "done",
            completedAt: "2026-05-11T12:00:00.000Z",
          },
        },
      ],
    });
  });

  it("uses stable labels and safe fallback state", () => {
    const entry = buildTaskUndoEntry({
      op: "status-change",
      taskIds: [9],
      tasks: new Map(),
      status: "blocked",
      timestamp: 456,
    });

    expect(entry.id).toBe("status-456-9");
    expect(entry.label).toBe("1 task \u2192 blocked");
    expect(entry.mutations).toEqual([
      {
        taskId: 9,
        restore: { status: "pending", completedAt: null },
      },
    ]);
  });

  it("prompts for recurring masters and materialized instances", () => {
    expect(
      shouldPromptForRecurringDelete({
        recurrence: "FREQ=WEEKLY",
        recurringTaskId: null,
      }),
    ).toBe(true);
    expect(
      shouldPromptForRecurringDelete({
        recurrence: null,
        recurringTaskId: 12,
      }),
    ).toBe(true);
    expect(
      shouldPromptForRecurringDelete({
        recurrence: null,
        recurringTaskId: null,
      }),
    ).toBe(false);
  });

  it("builds immediate optimistic task status snapshots", () => {
    const current = task({ status: "wip" });

    expect(
      optimisticTaskForOperation(current, "complete", {
        timestamp: "2026-05-15T12:00:00.000Z",
      }),
    ).toMatchObject({
      id: 1,
      status: "done",
      completedAt: "2026-05-15T12:00:00.000Z",
    });

    expect(
      optimisticTaskForOperation(current, "status-change", {
        status: "blocked",
      }),
    ).toMatchObject({
      id: 1,
      status: "blocked",
      completedAt: null,
    });
  });

  it("merges optimistic task patches over stale server tasks", () => {
    const tasks = [task()];
    const optimistic = new Map([
      [
        1,
        task({
          status: "done",
          completedAt: "2026-05-15T12:00:00.000Z",
        }),
      ],
      [
        2,
        task({
          id: 2,
          description: "spawned",
        }),
      ],
    ]);

    expect(mergeOptimisticTasks(tasks, optimistic)).toEqual([
      task({
        status: "done",
        completedAt: "2026-05-15T12:00:00.000Z",
      }),
      task({
        id: 2,
        description: "spawned",
      }),
    ]);
  });
});
