import { beforeEach, describe, expect, it } from "vitest";
import { createTask, getTask } from "@/core/task";
import { saveTaskDetails } from "@/core/task-detail-save";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = "1".repeat(64);
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("saveTaskDetails", () => {
  it("updates task detail fields in one call", () => {
    const task = createTask(db, userId, { description: "Old title" });

    const result = saveTaskDetails(db, userId, task.id, {
      task: { description: "New title", category: "Focus" },
    });

    expect(result.task.description).toBe("New title");
    expect(result.task.category).toBe("Focus");
    expect(getTask(db, task.id)?.description).toBe("New title");
  });

  it("rejects saving another user's task", () => {
    const otherUserId = createTestUser(db, "other").id;
    const task = createTask(db, otherUserId, { description: "Other task" });

    expect(() =>
      saveTaskDetails(db, userId, task.id, {
        task: { description: "Should not persist" },
      }),
    ).toThrow("Task not found");

    expect(getTask(db, task.id)?.description).toBe("Other task");
  });
});
