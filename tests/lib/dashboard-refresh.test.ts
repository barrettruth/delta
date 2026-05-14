import { describe, expect, it } from "vitest";
import { syncSummaryChangedTasks } from "@/lib/dashboard-refresh";

describe("dashboard refresh helpers", () => {
  it("only treats sync summaries as task-changing when task rows changed", () => {
    expect(
      syncSummaryChangedTasks({ created: 0, updated: 0, cancelled: 0 }),
    ).toBe(false);
    expect(
      syncSummaryChangedTasks({ created: 1, updated: 0, cancelled: 0 }),
    ).toBe(true);
    expect(
      syncSummaryChangedTasks({ created: 0, updated: 1, cancelled: 0 }),
    ).toBe(true);
    expect(
      syncSummaryChangedTasks({ created: 0, updated: 0, cancelled: 1 }),
    ).toBe(true);
  });
});
