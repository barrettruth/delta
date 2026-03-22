import { describe, expect, it } from "vitest";
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
});
