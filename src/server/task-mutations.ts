import "server-only";

import { eq } from "drizzle-orm";
import { addDependency, removeDependency } from "@/core/dag";
import {
  deleteAllInstances,
  deleteThisAndFuture,
  deleteThisInstance,
  editAllInstances,
  editThisAndFuture,
  editThisInstance,
} from "@/core/recurrence-editing";
import { materializeInstance } from "@/core/recurrence-expansion";
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  updateTask,
} from "@/core/task";
import { saveTaskDetails } from "@/core/task-detail-save";
import type {
  CreateTaskInput,
  Db,
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "@/core/types";
import { tasks } from "@/db/schema";

export type TaskMutationScope = "this" | "future" | "all";

export class TaskMutationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "TaskMutationError";
  }
}

export function isTaskMutationError(
  error: unknown,
): error is TaskMutationError {
  return error instanceof TaskMutationError;
}

function taskNotFound(message = "Task not found"): TaskMutationError {
  return new TaskMutationError(message, 404);
}

function badRequest(message: string): TaskMutationError {
  return new TaskMutationError(message, 400);
}

export function findOwnedTask(
  db: Db,
  userId: number,
  taskId: number,
): Task | null {
  const task = getTask(db, taskId);
  if (!task || task.userId !== userId) return null;
  return task;
}

export function requireOwnedTask(
  db: Db,
  userId: number,
  taskId: number,
  message = "Task not found",
): Task {
  const task = findOwnedTask(db, userId, taskId);
  if (!task) throw taskNotFound(message);
  return task;
}

export function createTaskForUser(
  db: Db,
  userId: number,
  input: CreateTaskInput,
): Task {
  return createTask(db, userId, input);
}

export interface UpdateTaskForUserOptions {
  scope?: string | null;
  instanceDate?: string | null;
}

function updateRecurringTaskForUser(
  db: Db,
  userId: number,
  taskId: number,
  updates: UpdateTaskInput,
  scope: TaskMutationScope,
  instanceDate: string | null | undefined,
): Task {
  if (scope === "this") {
    if (!instanceDate) {
      throw badRequest("instanceDate is required when scope is 'this'");
    }
    return editThisInstance(db, userId, taskId, instanceDate, updates);
  }

  if (scope === "future") {
    if (!instanceDate) {
      throw badRequest("instanceDate is required when scope is 'future'");
    }
    return editThisAndFuture(db, userId, taskId, instanceDate, updates);
  }

  return editAllInstances(db, userId, taskId, updates);
}

export function updateTaskForUser(
  db: Db,
  userId: number,
  taskId: number,
  input: UpdateTaskInput,
  options: UpdateTaskForUserOptions = {},
): Task {
  const existing = requireOwnedTask(db, userId, taskId);

  if (
    existing.recurrence &&
    (options.scope === "this" ||
      options.scope === "future" ||
      options.scope === "all")
  ) {
    return updateRecurringTaskForUser(
      db,
      userId,
      taskId,
      input,
      options.scope,
      options.instanceDate,
    );
  }

  if (input.status === "done") {
    return completeTask(db, userId, taskId).task;
  }

  return updateTask(db, taskId, input);
}

export function saveTaskDetailsForUser(
  db: Db,
  userId: number,
  taskId: number,
  input: { task: UpdateTaskInput },
): ReturnType<typeof saveTaskDetails> {
  requireOwnedTask(db, userId, taskId);
  return saveTaskDetails(db, userId, taskId, input);
}

export function completeTaskForUser(
  db: Db,
  userId: number,
  taskId: number,
): ReturnType<typeof completeTask> {
  requireOwnedTask(db, userId, taskId);
  return completeTask(db, userId, taskId);
}

export type DeleteTaskForUserResult =
  | { kind: "task"; task: Task }
  | { kind: "recurrence-scope"; scope: TaskMutationScope };

export interface DeleteTaskForUserOptions {
  scope?: string | null;
  instanceDate?: string | null;
}

export function deleteTaskForUser(
  db: Db,
  userId: number,
  taskId: number,
  options: DeleteTaskForUserOptions = {},
): DeleteTaskForUserResult {
  const existing = requireOwnedTask(db, userId, taskId);

  if (existing.recurrence && options.scope === "this") {
    if (!options.instanceDate) {
      throw badRequest("instanceDate is required when scope is 'this'");
    }
    deleteThisInstance(db, userId, taskId, options.instanceDate);
    return { kind: "recurrence-scope", scope: "this" };
  }

  if (existing.recurrence && options.scope === "future") {
    if (!options.instanceDate) {
      throw badRequest("instanceDate is required when scope is 'future'");
    }
    deleteThisAndFuture(db, userId, taskId, options.instanceDate);
    return { kind: "recurrence-scope", scope: "future" };
  }

  if (existing.recurrence && options.scope === "all") {
    deleteAllInstances(db, taskId);
    return { kind: "recurrence-scope", scope: "all" };
  }

  return { kind: "task", task: deleteTask(db, taskId) };
}

export function addDependencyForUser(
  db: Db,
  userId: number,
  taskId: number,
  dependsOnId: number,
): void {
  requireOwnedTask(db, userId, taskId);
  requireOwnedTask(db, userId, dependsOnId, "Dependency task not found");
  addDependency(db, taskId, dependsOnId);
}

export function removeDependencyForUser(
  db: Db,
  userId: number,
  taskId: number,
  dependsOnId: number,
): void {
  requireOwnedTask(db, userId, taskId);
  removeDependency(db, taskId, dependsOnId);
}

export function materializeInstanceForUser(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
): Task {
  requireOwnedTask(db, userId, masterId);
  return materializeInstance(db, userId, masterId, instanceDate);
}

export function completeVirtualInstanceForUser(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
): Task {
  const task = materializeInstanceForUser(db, userId, masterId, instanceDate);
  return completeTask(db, userId, task.id).task;
}

export function editRecurringInstanceForUser(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
  updates: UpdateTaskInput,
): Task {
  requireOwnedTask(db, userId, masterId);
  return editThisInstance(db, userId, masterId, instanceDate, updates);
}

export function editThisAndFutureForUser(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
  updates: UpdateTaskInput,
): Task {
  requireOwnedTask(db, userId, masterId);
  return editThisAndFuture(db, userId, masterId, instanceDate, updates);
}

export function editAllInstancesForUser(
  db: Db,
  userId: number,
  masterId: number,
  updates: UpdateTaskInput,
): Task {
  requireOwnedTask(db, userId, masterId);
  return editAllInstances(db, userId, masterId, updates);
}

export function deleteThisInstanceForUser(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
): void {
  requireOwnedTask(db, userId, masterId);
  deleteThisInstance(db, userId, masterId, instanceDate);
}

export function deleteThisAndFutureForUser(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
): void {
  requireOwnedTask(db, userId, masterId);
  deleteThisAndFuture(db, userId, masterId, instanceDate);
}

export function deleteAllInstancesForUser(
  db: Db,
  userId: number,
  masterId: number,
): void {
  requireOwnedTask(db, userId, masterId);
  deleteAllInstances(db, masterId);
}

export interface UndoTaskMutation {
  taskId: number;
  status: string;
  completedAt: string | null;
}

export interface UndoCompleteTaskMutation extends UndoTaskMutation {
  spawnedTaskId?: number;
}

export function undoTaskMutationsForUser(
  db: Db,
  userId: number,
  mutations: UndoTaskMutation[],
): void {
  for (const mutation of mutations) {
    requireOwnedTask(db, userId, mutation.taskId);
  }

  for (const mutation of mutations) {
    db.update(tasks)
      .set({
        status: mutation.status as TaskStatus,
        completedAt: mutation.completedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, mutation.taskId))
      .run();
  }
}

export function undoCompleteTaskMutationsForUser(
  db: Db,
  userId: number,
  mutations: UndoCompleteTaskMutation[],
): void {
  for (const mutation of mutations) {
    requireOwnedTask(db, userId, mutation.taskId);
    if (mutation.spawnedTaskId) {
      const spawnedTask = getTask(db, mutation.spawnedTaskId);
      if (spawnedTask && spawnedTask.userId !== userId) throw taskNotFound();
    }
  }

  for (const mutation of mutations) {
    db.update(tasks)
      .set({
        status: mutation.status as TaskStatus,
        completedAt: mutation.completedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, mutation.taskId))
      .run();
    if (mutation.spawnedTaskId) {
      db.delete(tasks).where(eq(tasks.id, mutation.spawnedTaskId)).run();
    }
  }
}
