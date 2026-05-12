"use server";

import { revalidatePath } from "next/cache";
import { removeCategoryColor, setCategoryColor } from "@/core/categories";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@/core/types";
import { db } from "@/db";
import { getLocalOwner } from "@/lib/local-owner";
import {
  formatValidationErrors,
  parseCreateTaskInput,
  parseUpdateTaskInput,
} from "@/lib/validation";
import {
  addDependencyForUser,
  completeTaskForUser,
  completeVirtualInstanceForUser,
  createTaskForUser,
  deleteAllInstancesForUser,
  deleteTaskForUser,
  deleteThisAndFutureForUser,
  deleteThisInstanceForUser,
  editAllInstancesForUser,
  editRecurringInstanceForUser,
  editThisAndFutureForUser,
  materializeInstanceForUser,
  removeDependencyForUser,
  saveTaskDetailsForUser,
  undoCompleteTaskMutationsForUser,
  undoTaskMutationsForUser,
  updateTaskForUser,
} from "@/server/task-mutations";

type ActionResult<T> = { data: T } | { error: string };

function validationFailure(
  errors?: Parameters<typeof formatValidationErrors>[0],
) {
  return { error: formatValidationErrors(errors) };
}

async function requireUser() {
  const user = await getLocalOwner();
  return user;
}

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult<Task>> {
  try {
    const validation = parseCreateTaskInput(input);
    if (!validation.success || !validation.data) {
      return validationFailure(validation.errors);
    }

    const user = await requireUser();
    const task = createTaskForUser(db, user.id, validation.data);
    revalidatePath("/", "layout");
    return { data: task };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create task" };
  }
}

export async function updateTaskAction(
  id: number,
  input: UpdateTaskInput,
): Promise<ActionResult<Task>> {
  try {
    const validation = parseUpdateTaskInput(input);
    if (!validation.success || !validation.data) {
      return validationFailure(validation.errors);
    }

    const user = await requireUser();
    const task = updateTaskForUser(db, user.id, id, validation.data);
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
  },
): Promise<ActionResult<ReturnType<typeof saveTaskDetailsForUser>>> {
  try {
    const validation = parseUpdateTaskInput(input.task);
    if (!validation.success || !validation.data) {
      return validationFailure(validation.errors);
    }

    const user = await requireUser();
    const result = saveTaskDetailsForUser(db, user.id, id, {
      task: validation.data,
    });
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
): Promise<ActionResult<ReturnType<typeof completeTaskForUser>>> {
  try {
    const user = await requireUser();
    const result = completeTaskForUser(db, user.id, id);
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
): Promise<ActionResult<Task>> {
  try {
    const user = await requireUser();
    const result = deleteTaskForUser(db, user.id, id);
    if (result.kind !== "task") throw new Error("Failed to delete task");
    revalidatePath("/", "layout");
    return { data: result.task };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete task" };
  }
}

export async function addDependencyAction(
  taskId: number,
  dependsOnId: number,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    addDependencyForUser(db, user.id, taskId, dependsOnId);
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
    setCategoryColor(db, user.id, category, color);
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
    removeCategoryColor(db, user.id, category);
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
    const user = await requireUser();
    removeDependencyForUser(db, user.id, taskId, dependsOnId);
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
    const user = await requireUser();
    undoTaskMutationsForUser(db, user.id, mutations);
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
    const task = materializeInstanceForUser(
      db,
      user.id,
      masterId,
      instanceDate,
    );
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
    const task = completeVirtualInstanceForUser(
      db,
      user.id,
      masterId,
      instanceDate,
    );
    revalidatePath("/", "layout");
    return { data: task };
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
    const validation = parseUpdateTaskInput(updates);
    if (!validation.success || !validation.data) {
      return validationFailure(validation.errors);
    }

    const user = await requireUser();
    const task = editRecurringInstanceForUser(
      db,
      user.id,
      masterId,
      instanceDate,
      validation.data,
    );
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
    const validation = parseUpdateTaskInput(updates);
    if (!validation.success || !validation.data) {
      return validationFailure(validation.errors);
    }

    const user = await requireUser();
    const task = editThisAndFutureForUser(
      db,
      user.id,
      masterId,
      instanceDate,
      validation.data,
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
    const validation = parseUpdateTaskInput(updates);
    if (!validation.success || !validation.data) {
      return validationFailure(validation.errors);
    }

    const user = await requireUser();
    const task = editAllInstancesForUser(
      db,
      user.id,
      masterId,
      validation.data,
    );
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
    deleteThisInstanceForUser(db, user.id, masterId, instanceDate);
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
    deleteThisAndFutureForUser(db, user.id, masterId, instanceDate);
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
    deleteAllInstancesForUser(db, user.id, masterId);
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
    const user = await requireUser();
    undoCompleteTaskMutationsForUser(db, user.id, mutations);
    revalidatePath("/", "layout");
    return { data: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to undo" };
  }
}
