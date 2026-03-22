import { and, eq, inArray, notInArray } from "drizzle-orm";
import { taskDependencies, tasks } from "@/db/schema";
import type { Db, Task } from "./types";

export function addDependency(
  db: Db,
  taskId: number,
  dependsOnId: number,
): void {
  if (taskId === dependsOnId) {
    throw new Error("A task cannot depend on itself");
  }

  if (hasCycle(db, taskId, dependsOnId)) {
    throw new Error("Adding this dependency would create a cycle");
  }

  db.insert(taskDependencies).values({ taskId, dependsOnId }).run();

  const task = db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get();

  if (task?.status === "pending") {
    db.update(tasks)
      .set({ status: "blocked", updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, taskId))
      .run();
  }
}

export function removeDependency(
  db: Db,
  taskId: number,
  dependsOnId: number,
): void {
  db.delete(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.dependsOnId, dependsOnId),
      ),
    )
    .run();

  const remaining = db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId))
    .all();

  if (remaining.length === 0) {
    const task = db
      .select({ status: tasks.status })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get();

    if (task?.status === "blocked") {
      db.update(tasks)
        .set({ status: "pending", updatedAt: new Date().toISOString() })
        .where(eq(tasks.id, taskId))
        .run();
    }
  }
}

export function getDependencies(db: Db, taskId: number): Task[] {
  const deps = db
    .select({ dependsOnId: taskDependencies.dependsOnId })
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId))
    .all();

  if (deps.length === 0) return [];

  const ids = deps.map((d) => d.dependsOnId);
  return db.select().from(tasks).where(inArray(tasks.id, ids)).all();
}

export function getDependents(db: Db, taskId: number): Task[] {
  const deps = db
    .select({ taskId: taskDependencies.taskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.dependsOnId, taskId))
    .all();

  if (deps.length === 0) return [];

  const ids = deps.map((d) => d.taskId);
  return db.select().from(tasks).where(inArray(tasks.id, ids)).all();
}

export function hasCycle(
  db: Db,
  taskId: number,
  newDependsOnId: number,
): boolean {
  const visited = new Set<number>();
  const stack = [newDependsOnId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = db
      .select({ dependsOnId: taskDependencies.dependsOnId })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, current))
      .all();

    for (const dep of deps) {
      stack.push(dep.dependsOnId);
    }
  }

  return false;
}

export function updateBlockedStatus(db: Db, completedTaskId: number): void {
  const dependents = db
    .select({ taskId: taskDependencies.taskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.dependsOnId, completedTaskId))
    .all();

  for (const { taskId } of dependents) {
    const unresolvedDeps = db
      .select()
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.dependsOnId, tasks.id))
      .where(
        and(
          eq(taskDependencies.taskId, taskId),
          notInArray(tasks.status, ["done", "cancelled"]),
        ),
      )
      .all();

    if (unresolvedDeps.length === 0) {
      db.update(tasks)
        .set({ status: "pending", updatedAt: new Date().toISOString() })
        .where(and(eq(tasks.id, taskId), eq(tasks.status, "blocked")))
        .run();
    }
  }
}
