import { describe, expect, it } from "vitest";
import { parseTaskFilters } from "@/core/task-filters";
import { ACTIVE_TASK_STATUSES } from "@/core/task-status";

describe("task filter parsing", () => {
  it("parses single, comma-delimited, and unknown status filters", () => {
    expect(parseTaskFilters({ status: "pending" })).toEqual({
      status: "pending",
    });

    expect(parseTaskFilters({ status: "done,wip" })).toEqual({
      status: ["done", "wip"],
    });

    expect(parseTaskFilters({ status: "unknown" })).toEqual({
      status: "unknown",
    });
  });

  it("normalizes route date aliases into due ranges", () => {
    expect(parseTaskFilters({ date: "2026-05-11" })).toEqual({
      dueAfter: "2026-05-11T00:00:00.000Z",
      dueBefore: "2026-05-11T23:59:59.999Z",
    });

    expect(
      parseTaskFilters({
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z",
      }),
    ).toEqual({
      dueAfter: "2026-05-01T00:00:00.000Z",
      dueBefore: "2026-05-31T23:59:59.999Z",
    });
  });

  it("keeps supported sort values and falls back on unknown fields", () => {
    expect(parseTaskFilters({ sortBy: "due", sortOrder: "asc" })).toEqual({
      sortBy: "due",
      sortOrder: "asc",
    });

    expect(parseTaskFilters({ sortBy: "unknown", sortOrder: "asc" })).toEqual({
      sortOrder: "asc",
    });

    expect(parseTaskFilters({ sortBy: "due", sortOrder: "up" })).toEqual({
      sortBy: "due",
    });
  });

  it("applies default filters only when callers omit them", () => {
    expect(
      parseTaskFilters(
        {},
        {
          defaults: {
            status: ACTIVE_TASK_STATUSES,
            sortBy: "order",
            sortOrder: "desc",
          },
        },
      ),
    ).toEqual({
      status: ACTIVE_TASK_STATUSES,
      sortBy: "order",
      sortOrder: "desc",
    });

    expect(
      parseTaskFilters(
        { status: "done", sortBy: "due" },
        {
          defaults: {
            status: ACTIVE_TASK_STATUSES,
            sortBy: "order",
            sortOrder: "desc",
          },
        },
      ),
    ).toEqual({
      status: "done",
      sortBy: "due",
      sortOrder: "desc",
    });
  });
});
