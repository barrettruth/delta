import { describe, expect, it } from "vitest";
import { KANBAN_COLUMNS } from "@/core/task-status";
import {
  groupKanbanTasksByStatus,
  kanbanTaskIdRangeSet,
  kanbanVisibleColumnIndices,
  kanbanVisibleColumns,
  moveKanbanVisibleColumnIndex,
} from "@/lib/kanban-board";

const tasks = [
  { id: 1, status: "pending" as const },
  { id: 2, status: "wip" as const },
  { id: 3, status: "pending" as const },
  { id: 4, status: "blocked" as const },
];

describe("kanban board helpers", () => {
  it("groups tasks by status without reordering", () => {
    const grouped = groupKanbanTasksByStatus(tasks);

    expect(grouped.pending?.map((task) => task.id)).toEqual([1, 3]);
    expect(grouped.wip?.map((task) => task.id)).toEqual([2]);
    expect(grouped.blocked?.map((task) => task.id)).toEqual([4]);
    expect(grouped.done).toBeUndefined();
  });

  it("builds visual selection ranges in either direction", () => {
    expect([...kanbanTaskIdRangeSet(tasks, 0, 2)]).toEqual([1, 2, 3]);
    expect([...kanbanTaskIdRangeSet(tasks, 2, 0)]).toEqual([1, 2, 3]);
    expect([...kanbanTaskIdRangeSet(tasks, -2, 1)]).toEqual([1, 2]);
    expect([...kanbanTaskIdRangeSet(tasks, 2, 99)]).toEqual([3, 4]);
  });

  it("finds visible columns from grouped task counts", () => {
    const grouped = groupKanbanTasksByStatus(tasks);

    expect(kanbanVisibleColumnIndices(KANBAN_COLUMNS, grouped)).toEqual([
      0, 1, 2,
    ]);
    expect(
      kanbanVisibleColumns(KANBAN_COLUMNS, grouped).map((col) => col.status),
    ).toEqual(["pending", "wip", "blocked"]);
  });

  it("moves the cursor through visible columns only", () => {
    const grouped = groupKanbanTasksByStatus(tasks);

    expect(
      moveKanbanVisibleColumnIndex({
        columns: KANBAN_COLUMNS,
        currentIndex: 0,
        delta: 1,
        grouped,
      }),
    ).toBe(1);
    expect(
      moveKanbanVisibleColumnIndex({
        columns: KANBAN_COLUMNS,
        currentIndex: 2,
        delta: 1,
        grouped,
      }),
    ).toBe(2);
    expect(
      moveKanbanVisibleColumnIndex({
        columns: KANBAN_COLUMNS,
        currentIndex: 3,
        delta: -1,
        grouped,
      }),
    ).toBe(0);
  });
});
