import { describe, expect, it } from "vitest";
import { filterTasksByQuery, formatTaskSearchCount } from "@/lib/task-search";

const tasks = [
  { id: 1, description: "Plan Alpha launch", category: "Ops" },
  { id: 2, description: "Write notes", category: "Research" },
  { id: 3, description: "Book travel", category: null, location: "Alpha room" },
  { id: 4, description: "Review budget", category: "alpha-team" },
];

describe("task search", () => {
  it("keeps the original task list for an empty query", () => {
    expect(filterTasksByQuery(tasks, "")).toBe(tasks);
  });

  it("matches description and category case-insensitively without reordering", () => {
    expect(filterTasksByQuery(tasks, "ALPHA").map((task) => task.id)).toEqual([
      1, 4,
    ]);
  });

  it("does not match unrelated task fields", () => {
    expect(filterTasksByQuery(tasks, "room")).toEqual([]);
  });

  it("formats compact result counts", () => {
    expect(formatTaskSearchCount(2, 4)).toBe("2/4");
  });
});
