"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { addDependency, removeDependency } from "@/core/dag";
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  updateTask,
} from "@/core/task";
import type { CreateTaskInput, TaskStatus, UpdateTaskInput } from "@/core/types";
import { db } from "@/db";
import { categoryColors, tasks } from "@/db/schema";
import { getAuthUser } from "@/lib/auth-middleware";

type ActionResult<T> = { data: T } | { error: string };

async function requireUser() {
  const user = await getAuthUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

async function requireOwnedTask(taskId: number) {
  const user = await requireUser();
  const task = getTask(db, taskId);
  if (!task || task.userId !== user.id) throw new Error("Task not found");
  return { user, task };
}

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult<ReturnType<typeof createTask>>> {
  try {
    const user = await requireUser();
    const task = createTask(db, user.id, input);
    revalidatePath("/");
    return { data: task };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create task" };
  }
}

export async function updateTaskAction(
  id: number,
  input: UpdateTaskInput,
): Promise<ActionResult<ReturnType<typeof updateTask>>> {
  try {
    const { user } = await requireOwnedTask(id);
    void user;
    const task = updateTask(db, id, input);
    revalidatePath("/");
    return { data: task };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update task" };
  }
}

export async function completeTaskAction(
  id: number,
): Promise<ActionResult<ReturnType<typeof completeTask>>> {
  try {
    const { user } = await requireOwnedTask(id);
    const result = completeTask(db, user.id, id);
    revalidatePath("/");
    return { data: result };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to complete task",
    };
  }
}

export async function deleteTaskAction(
  id: number,
): Promise<ActionResult<ReturnType<typeof deleteTask>>> {
  try {
    await requireOwnedTask(id);
    const task = deleteTask(db, id);
    revalidatePath("/");
    return { data: task };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete task" };
  }
}

export async function addDependencyAction(
  taskId: number,
  dependsOnId: number,
): Promise<ActionResult<null>> {
  try {
    await requireOwnedTask(taskId);
    await requireOwnedTask(dependsOnId);
    addDependency(db, taskId, dependsOnId);
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to add dependency",
    };
  }
}

export async function setCategoryColorAction(
  category: string,
  color: string,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    db.insert(categoryColors)
      .values({ userId: user.id, category, color })
      .onConflictDoUpdate({
        target: [categoryColors.userId, categoryColors.category],
        set: { color },
      })
      .run();
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to set category color",
    };
  }
}

export async function removeCategoryColorAction(
  category: string,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    db.delete(categoryColors)
      .where(
        and(
          eq(categoryColors.userId, user.id),
          eq(categoryColors.category, category),
        ),
      )
      .run();
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to remove category color",
    };
  }
}

export async function removeDependencyAction(
  taskId: number,
  dependsOnId: number,
): Promise<ActionResult<null>> {
  try {
    await requireOwnedTask(taskId);
    removeDependency(db, taskId, dependsOnId);
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to remove dependency",
    };
  }
}

export async function undoTaskAction(
  mutations: Array<{
    taskId: number;
    status: string;
    completedAt: string | null;
  }>,
): Promise<ActionResult<null>> {
  try {
    await requireUser();
    for (const m of mutations) {
      db.update(tasks)
        .set({
          status: m.status as TaskStatus,
          completedAt: m.completedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, m.taskId))
        .run();
    }
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to undo" };
  }
}

export async function undoCompleteTaskAction(
  mutations: Array<{
    taskId: number;
    status: string;
    completedAt: string | null;
    spawnedTaskId?: number;
  }>,
): Promise<ActionResult<null>> {
  try {
    await requireUser();
    for (const m of mutations) {
      db.update(tasks)
        .set({
          status: m.status as TaskStatus,
          completedAt: m.completedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, m.taskId))
        .run();
      if (m.spawnedTaskId) {
        db.delete(tasks).where(eq(tasks.id, m.spawnedTaskId)).run();
      }
    }
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to undo" };
  }
}
