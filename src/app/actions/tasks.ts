"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "@/core/types";
import { db } from "@/db";
import { categoryColors, tasks } from "@/db/schema";
import { getAuthUser } from "@/lib/auth-middleware";
import type { TaskPanelReminderDraft } from "@/lib/task-panel-reminders";

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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
    return { data: task };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update task" };
  }
}

export async function saveTaskDetailsAction(
  id: number,
  input: {
    task: UpdateTaskInput;
    reminders?: TaskPanelReminderDraft[] | null;
  },
): Promise<ActionResult<ReturnType<typeof saveTaskDetails>>> {
  try {
    const { user } = await requireOwnedTask(id);
    const result = saveTaskDetails(db, user.id, id, input);
    revalidatePath("/", "layout");
    return { data: result };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to save task details",
    };
  }
}

export async function completeTaskAction(
  id: number,
): Promise<ActionResult<ReturnType<typeof completeTask>>> {
  try {
    const { user } = await requireOwnedTask(id);
    const result = completeTask(db, user.id, id);
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
    return { data: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to undo" };
  }
}

export async function materializeInstanceAction(
  masterId: number,
  instanceDate: string,
): Promise<ActionResult<Task>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    const task = materializeInstance(db, user.id, masterId, instanceDate);
    revalidatePath("/", "layout");
    return { data: task };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to materialize instance",
    };
  }
}

export async function completeVirtualInstanceAction(
  masterId: number,
  instanceDate: string,
): Promise<ActionResult<Task>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    const task = materializeInstance(db, user.id, masterId, instanceDate);
    const result = completeTask(db, user.id, task.id);
    revalidatePath("/", "layout");
    return { data: result.task };
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Failed to complete virtual instance",
    };
  }
}

export async function editRecurringInstanceAction(
  masterId: number,
  instanceDate: string,
  updates: UpdateTaskInput,
): Promise<ActionResult<Task>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    const task = editThisInstance(db, user.id, masterId, instanceDate, updates);
    revalidatePath("/", "layout");
    return { data: task };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to edit instance",
    };
  }
}

export async function editThisAndFutureAction(
  masterId: number,
  instanceDate: string,
  updates: UpdateTaskInput,
): Promise<ActionResult<Task>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    const task = editThisAndFuture(
      db,
      user.id,
      masterId,
      instanceDate,
      updates,
    );
    revalidatePath("/", "layout");
    return { data: task };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to edit instances",
    };
  }
}

export async function editAllInstancesAction(
  masterId: number,
  updates: UpdateTaskInput,
): Promise<ActionResult<Task>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    const task = editAllInstances(db, user.id, masterId, updates);
    revalidatePath("/", "layout");
    return { data: task };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to edit instances",
    };
  }
}

export async function deleteThisInstanceAction(
  masterId: number,
  instanceDate: string,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    deleteThisInstance(db, user.id, masterId, instanceDate);
    revalidatePath("/", "layout");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to delete instance",
    };
  }
}

export async function deleteThisAndFutureAction(
  masterId: number,
  instanceDate: string,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    deleteThisAndFuture(db, user.id, masterId, instanceDate);
    revalidatePath("/", "layout");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to delete instances",
    };
  }
}

export async function deleteAllInstancesAction(
  masterId: number,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const master = getTask(db, masterId);
    if (!master || master.userId !== user.id) throw new Error("Task not found");
    deleteAllInstances(db, masterId);
    revalidatePath("/", "layout");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to delete instances",
    };
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
    revalidatePath("/", "layout");
    return { data: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to undo" };
  }
}
