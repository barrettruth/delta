import { describe, expect, it } from "vitest";
import { mapGoogleTask } from "@/core/google/tasks-mapper";
import type { GoogleTask, GoogleTaskList } from "@/core/google/types";

const list: GoogleTaskList = {
  id: "list-1",
  title: "Errands",
  updated: "2026-05-10T12:00:00.000Z",
};

function task(overrides: Partial<GoogleTask> = {}): GoogleTask {
  return {
    id: "task-1",
    title: "Buy milk",
    status: "needsAction",
    updated: "2026-05-11T12:00:00.000Z",
    etag: "etag-1",
    ...overrides,
  };
}

describe("mapGoogleTask", () => {
  it("maps active tasks into Delta task input and metadata", () => {
    const mapped = mapGoogleTask(
      list,
      task({
        notes: "Remember oat milk",
        due: "2026-05-14T00:00:00.000Z",
      }),
      "2026-05-11T13:00:00.000Z",
    );

    expect(mapped.externalId).toBe("list-1:task-1");
    expect(mapped.input).toMatchObject({
      description: "Buy milk",
      status: "pending",
      category: "Errands",
      due: "2026-05-14",
      completedAt: null,
    });
    expect(JSON.parse(mapped.input.notes ?? "{}")).toMatchObject({
      type: "doc",
    });
    expect(mapped.metadata).toMatchObject({
      listId: "list-1",
      listTitle: "Errands",
      taskId: "task-1",
      etag: "etag-1",
    });
  });

  it("maps omitted due dates as an explicit clear", () => {
    const mapped = mapGoogleTask(list, task(), "2026-05-11T13:00:00.000Z");

    expect(mapped.input.due).toBeNull();
  });

  it("maps completed and deleted tasks deliberately", () => {
    const completed = mapGoogleTask(
      list,
      task({
        status: "completed",
        completed: "2026-05-11T12:30:00.000Z",
        hidden: true,
      }),
      "2026-05-11T13:00:00.000Z",
    );
    const deleted = mapGoogleTask(
      list,
      task({ deleted: true }),
      "2026-05-11T13:00:00.000Z",
    );

    expect(completed.input.status).toBe("done");
    expect(completed.input.completedAt).toBe("2026-05-11T12:30:00.000Z");
    expect(completed.metadata.hidden).toBe(true);
    expect(deleted.input.status).toBe("cancelled");
    expect(deleted.input.completedAt).toBe("2026-05-11T12:00:00.000Z");
    expect(deleted.metadata.deleted).toBe(true);
  });
});
