"use server";

import { revalidatePath } from "next/cache";
import { addDependency, removeDependency } from "@/core/dag";
import { completeTask, createTask, deleteTask, updateTask } from "@/core/task";
import type { CreateTaskInput, UpdateTaskInput } from "@/core/types";
import { db } from "@/db";

export async function createTaskAction(input: CreateTaskInput) {
  const task = createTask(db, input);
  revalidatePath("/");
  return task;
}

export async function updateTaskAction(id: number, input: UpdateTaskInput) {
  const task = updateTask(db, id, input);
  revalidatePath("/");
  return task;
}

export async function completeTaskAction(id: number) {
  const task = completeTask(db, id);
  revalidatePath("/");
  return task;
}

export async function deleteTaskAction(id: number) {
  const task = deleteTask(db, id);
  revalidatePath("/");
  return task;
}

export async function addDependencyAction(taskId: number, dependsOnId: number) {
  addDependency(db, taskId, dependsOnId);
  revalidatePath("/");
}

export async function removeDependencyAction(
  taskId: number,
  dependsOnId: number,
) {
  removeDependency(db, taskId, dependsOnId);
  revalidatePath("/");
}
