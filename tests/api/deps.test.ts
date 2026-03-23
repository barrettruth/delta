import { beforeEach, describe, expect, it } from "vitest";
import {
  addDependency,
  getDependencies,
  getDependents,
  removeDependency,
} from "@/core/dag";
import { completeTask, createTask, deleteTask, getTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("dependency management end-to-end", () => {
  it("adding dependency blocks the dependent task", () => {
    const upstream = createTask(db, userId, { description: "Build API" });
    const downstream = createTask(db, userId, { description: "Build UI" });

    addDependency(db, downstream.id, upstream.id);

    const blockedTask = getTask(db, downstream.id);
    expect(blockedTask?.status).toBe("blocked");

    const deps = getDependencies(db, downstream.id);
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe(upstream.id);
  });

  it("completing dependency unblocks the dependent task", () => {
    const upstream = createTask(db, userId, { description: "Setup DB" });
    const downstream = createTask(db, userId, { description: "Write queries" });

    addDependency(db, downstream.id, upstream.id);
    expect(getTask(db, downstream.id)?.status).toBe("blocked");

    completeTask(db, userId, upstream.id);
    expect(getTask(db, downstream.id)?.status).toBe("pending");
  });

  it("removing the last dependency unblocks the task", () => {
    const a = createTask(db, userId, { description: "A" });
    const b = createTask(db, userId, { description: "B" });

    addDependency(db, b.id, a.id);
    expect(getTask(db, b.id)?.status).toBe("blocked");

    removeDependency(db, b.id, a.id);
    expect(getTask(db, b.id)?.status).toBe("pending");
    expect(getDependencies(db, b.id)).toHaveLength(0);
  });

  it("removing one of multiple dependencies keeps task blocked", () => {
    const a = createTask(db, userId, { description: "A" });
    const b = createTask(db, userId, { description: "B" });
    const c = createTask(db, userId, { description: "C" });

    addDependency(db, c.id, a.id);
    addDependency(db, c.id, b.id);

    removeDependency(db, c.id, a.id);
    expect(getTask(db, c.id)?.status).toBe("blocked");
    expect(getDependencies(db, c.id)).toHaveLength(1);
  });

  it("cancelling dependency unblocks the dependent task", () => {
    const upstream = createTask(db, userId, { description: "Cancelled dep" });
    const downstream = createTask(db, userId, { description: "Waiting" });

    addDependency(db, downstream.id, upstream.id);
    expect(getTask(db, downstream.id)?.status).toBe("blocked");

    deleteTask(db, upstream.id);
    expect(getTask(db, downstream.id)?.status).toBe("pending");
  });
});

describe("cycle detection", () => {
  it("prevents self-dependency", () => {
    const a = createTask(db, userId, { description: "Self" });
    expect(() => addDependency(db, a.id, a.id)).toThrow(
      "cannot depend on itself",
    );
  });

  it("prevents direct cycle A -> B -> A", () => {
    const a = createTask(db, userId, { description: "A" });
    const b = createTask(db, userId, { description: "B" });

    addDependency(db, a.id, b.id);
    expect(() => addDependency(db, b.id, a.id)).toThrow("cycle");
  });

  it("prevents indirect cycle A -> B -> C -> A", () => {
    const a = createTask(db, userId, { description: "A" });
    const b = createTask(db, userId, { description: "B" });
    const c = createTask(db, userId, { description: "C" });

    addDependency(db, a.id, b.id);
    addDependency(db, b.id, c.id);
    expect(() => addDependency(db, c.id, a.id)).toThrow("cycle");
  });

  it("prevents cycle across longer chains A -> B -> C -> D -> A", () => {
    const a = createTask(db, userId, { description: "A" });
    const b = createTask(db, userId, { description: "B" });
    const c = createTask(db, userId, { description: "C" });
    const d = createTask(db, userId, { description: "D" });

    addDependency(db, a.id, b.id);
    addDependency(db, b.id, c.id);
    addDependency(db, c.id, d.id);

    expect(() => addDependency(db, d.id, a.id)).toThrow("cycle");
  });

  it("allows valid non-cyclic diamond dependency", () => {
    const a = createTask(db, userId, { description: "A" });
    const b = createTask(db, userId, { description: "B" });
    const c = createTask(db, userId, { description: "C" });
    const d = createTask(db, userId, { description: "D" });

    addDependency(db, a.id, b.id);
    addDependency(db, a.id, c.id);
    addDependency(db, b.id, d.id);
    expect(() => addDependency(db, c.id, d.id)).not.toThrow();
  });
});

describe("multi-dependency unblocking", () => {
  it("unblocks only when all dependencies are resolved", () => {
    const dep1 = createTask(db, userId, { description: "Dep 1" });
    const dep2 = createTask(db, userId, { description: "Dep 2" });
    const dep3 = createTask(db, userId, { description: "Dep 3" });
    const task = createTask(db, userId, { description: "Blocked task" });

    addDependency(db, task.id, dep1.id);
    addDependency(db, task.id, dep2.id);
    addDependency(db, task.id, dep3.id);
    expect(getTask(db, task.id)?.status).toBe("blocked");

    completeTask(db, userId, dep1.id);
    expect(getTask(db, task.id)?.status).toBe("blocked");

    completeTask(db, userId, dep2.id);
    expect(getTask(db, task.id)?.status).toBe("blocked");

    completeTask(db, userId, dep3.id);
    expect(getTask(db, task.id)?.status).toBe("pending");
  });

  it("treats mix of done and cancelled as all resolved", () => {
    const dep1 = createTask(db, userId, { description: "Will complete" });
    const dep2 = createTask(db, userId, { description: "Will cancel" });
    const task = createTask(db, userId, { description: "Waiting" });

    addDependency(db, task.id, dep1.id);
    addDependency(db, task.id, dep2.id);
    expect(getTask(db, task.id)?.status).toBe("blocked");

    completeTask(db, userId, dep1.id);
    expect(getTask(db, task.id)?.status).toBe("blocked");

    deleteTask(db, dep2.id);
    expect(getTask(db, task.id)?.status).toBe("pending");
  });

  it("getDependents returns all tasks that depend on a given task", () => {
    const upstream = createTask(db, userId, { description: "Shared dep" });
    const d1 = createTask(db, userId, { description: "Dependent 1" });
    const d2 = createTask(db, userId, { description: "Dependent 2" });
    const d3 = createTask(db, userId, { description: "Dependent 3" });

    addDependency(db, d1.id, upstream.id);
    addDependency(db, d2.id, upstream.id);
    addDependency(db, d3.id, upstream.id);

    const dependents = getDependents(db, upstream.id);
    expect(dependents).toHaveLength(3);

    const ids = dependents.map((t) => t.id).sort();
    expect(ids).toEqual([d1.id, d2.id, d3.id].sort());
  });

  it("completing shared dependency unblocks multiple dependents", () => {
    const shared = createTask(db, userId, { description: "Shared" });
    const t1 = createTask(db, userId, { description: "T1" });
    const t2 = createTask(db, userId, { description: "T2" });

    addDependency(db, t1.id, shared.id);
    addDependency(db, t2.id, shared.id);

    expect(getTask(db, t1.id)?.status).toBe("blocked");
    expect(getTask(db, t2.id)?.status).toBe("blocked");

    completeTask(db, userId, shared.id);

    expect(getTask(db, t1.id)?.status).toBe("pending");
    expect(getTask(db, t2.id)?.status).toBe("pending");
  });
});
