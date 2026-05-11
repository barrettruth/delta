import { describe, expect, it } from "vitest";
import type { TaskStatus } from "@/core/types";
import {
  buildTaskMap,
  buildTaskUndoEntry,
  shouldPromptForRecurringDelete,
} from "@/lib/task-operations";

type Snapshot = {
  id: number;
  status: TaskStatus;
  completedAt: string | null;
};

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
});
