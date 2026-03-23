import { beforeEach, describe, expect, it } from "vitest";
import {
  addDependency,
  getDependencies,
  getDependents,
  hasCycle,
  removeDependency,
  updateBlockedStatus,
} from "@/core/dag";
import { createTask, getTask, updateTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("addDependency", () => {
  it("adds a dependency between tasks", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);

    const deps = getDependencies(db, a.id);
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe(b.id);
  });

  it("blocks the dependent task", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);

    const task = getTask(db, a.id);
    expect(task?.status).toBe("blocked");
  });

  it("prevents self-dependency", () => {
    const a = createTask(db, { description: "A" });
    expect(() => addDependency(db, a.id, a.id)).toThrow(
      "cannot depend on itself",
    );
  });

  it("detects direct cycle", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);

    expect(() => addDependency(db, b.id, a.id)).toThrow("cycle");
  });

  it("detects indirect cycle", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    const c = createTask(db, { description: "C" });
    addDependency(db, a.id, b.id);
    addDependency(db, b.id, c.id);

    expect(() => addDependency(db, c.id, a.id)).toThrow("cycle");
  });

  it("allows adding a dependency on a done task without blocking", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    updateTask(db, b.id, { status: "done" });

    addDependency(db, a.id, b.id);
    const deps = getDependencies(db, a.id);
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe(b.id);
  });

  it("does not block a non-pending task when adding a dependency", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    updateTask(db, a.id, { status: "wip" });
    addDependency(db, a.id, b.id);

    const task = getTask(db, a.id);
    expect(task?.status).toBe("wip");
  });
});

describe("removeDependency", () => {
  it("removes a dependency", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);
    removeDependency(db, a.id, b.id);

    expect(getDependencies(db, a.id)).toHaveLength(0);
  });

  it("unblocks task when last dependency removed", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);

    expect(getTask(db, a.id)?.status).toBe("blocked");

    removeDependency(db, a.id, b.id);
    expect(getTask(db, a.id)?.status).toBe("pending");
  });

  it("keeps task blocked when other dependencies remain", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    const c = createTask(db, { description: "C" });
    addDependency(db, a.id, b.id);
    addDependency(db, a.id, c.id);

    removeDependency(db, a.id, b.id);
    expect(getTask(db, a.id)?.status).toBe("blocked");
  });
});

describe("getDependencies", () => {
  it("returns all dependencies of a task", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    const c = createTask(db, { description: "C" });
    addDependency(db, a.id, b.id);
    addDependency(db, a.id, c.id);

    const deps = getDependencies(db, a.id);
    expect(deps).toHaveLength(2);
    expect(deps.map((d) => d.id).sort()).toEqual([b.id, c.id].sort());
  });

  it("returns empty array for task with no dependencies", () => {
    const a = createTask(db, { description: "A" });
    expect(getDependencies(db, a.id)).toHaveLength(0);
  });
});

describe("getDependents", () => {
  it("returns all tasks that depend on a task", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    const c = createTask(db, { description: "C" });
    addDependency(db, b.id, a.id);
    addDependency(db, c.id, a.id);

    const dependents = getDependents(db, a.id);
    expect(dependents).toHaveLength(2);
  });
});

describe("hasCycle", () => {
  it("returns false for valid dependency", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    expect(hasCycle(db, a.id, b.id)).toBe(false);
  });

  it("returns true for direct cycle", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);
    expect(hasCycle(db, b.id, a.id)).toBe(true);
  });

  it("returns true for transitive cycle", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    const c = createTask(db, { description: "C" });
    addDependency(db, a.id, b.id);
    addDependency(db, b.id, c.id);
    expect(hasCycle(db, c.id, a.id)).toBe(true);
  });
});

describe("updateBlockedStatus", () => {
  it("unblocks task when all dependencies completed", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);
    expect(getTask(db, a.id)?.status).toBe("blocked");

    updateTask(db, b.id, { status: "done" });
    updateBlockedStatus(db, b.id);

    expect(getTask(db, a.id)?.status).toBe("pending");
  });

  it("keeps task blocked when unresolved dependencies remain", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    const c = createTask(db, { description: "C" });
    addDependency(db, a.id, b.id);
    addDependency(db, a.id, c.id);

    updateTask(db, b.id, { status: "done" });
    updateBlockedStatus(db, b.id);

    expect(getTask(db, a.id)?.status).toBe("blocked");
  });

  it("treats cancelled dependencies as resolved", () => {
    const a = createTask(db, { description: "A" });
    const b = createTask(db, { description: "B" });
    addDependency(db, a.id, b.id);

    updateTask(db, b.id, { status: "cancelled" });
    updateBlockedStatus(db, b.id);

    expect(getTask(db, a.id)?.status).toBe("pending");
  });

  it("unblocks multiple dependents when a shared dependency is deleted", () => {
    const dep = createTask(db, { description: "Shared" });
    const t1 = createTask(db, { description: "T1" });
    const t2 = createTask(db, { description: "T2" });
    addDependency(db, t1.id, dep.id);
    addDependency(db, t2.id, dep.id);
    expect(getTask(db, t1.id)?.status).toBe("blocked");
    expect(getTask(db, t2.id)?.status).toBe("blocked");

    updateTask(db, dep.id, { status: "cancelled" });
    updateBlockedStatus(db, dep.id);

    expect(getTask(db, t1.id)?.status).toBe("pending");
    expect(getTask(db, t2.id)?.status).toBe("pending");
  });
});
