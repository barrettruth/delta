"use server";

import { revalidatePath } from "next/cache";
import { addDependency, removeDependency } from "@/core/dag";
import { completeTask, createTask, deleteTask, updateTask } from "@/core/task";
import type { CreateTaskInput, UpdateTaskInput } from "@/core/types";
import { db } from "@/db";

type ActionResult<T> = { data: T } | { error: string };

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult<ReturnType<typeof createTask>>> {
  try {
    const task = createTask(db, input);
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
    const task = completeTask(db, id);
    revalidatePath("/");
    return { data: task };
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
    addDependency(db, taskId, dependsOnId);
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to add dependency",
    };
  }
}

export async function removeDependencyAction(
  taskId: number,
  dependsOnId: number,
): Promise<ActionResult<null>> {
  try {
    removeDependency(db, taskId, dependsOnId);
    revalidatePath("/");
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to remove dependency",
    };
  }
}
