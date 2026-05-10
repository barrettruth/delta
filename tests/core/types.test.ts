import { describe, expect, it } from "vitest";
import {
  ACTIVE_TASK_STATUSES,
  KANBAN_COLUMNS,
  TASK_STATUS_LABELS,
} from "@/core/task-status";
import { RECUR_MODES, TASK_STATUSES } from "@/core/types";

describe("types", () => {
  it("defines all task statuses", () => {
    expect(TASK_STATUSES).toEqual([
      "pending",
      "done",
      "wip",
      "blocked",
      "cancelled",
    ]);
  });

  it("defines recurrence modes", () => {
    expect(RECUR_MODES).toEqual(["scheduled", "completion"]);
  });

  it("defines canonical status labels and board columns", () => {
    expect(TASK_STATUS_LABELS.wip).toBe("In Progress");
    expect(ACTIVE_TASK_STATUSES).toEqual(["pending", "wip", "blocked"]);
    expect(KANBAN_COLUMNS.map((column) => column.status)).toEqual([
      "pending",
      "wip",
      "blocked",
      "done",
    ]);
  });
});
