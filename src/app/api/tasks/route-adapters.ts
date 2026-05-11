import { NextResponse } from "next/server";
import type { SafeUser } from "@/core/auth";
import type { Db, Task } from "@/core/types";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { findOwnedTask, isTaskMutationError } from "@/server/task-mutations";

type RouteAdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

export type TaskRouteParams = { params: Promise<{ id: string }> };
export type DependencyRouteParams = {
  params: Promise<{ id: string; depId: string }>;
};

export function taskRouteError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function taskNotFoundResponse(): NextResponse {
  return taskRouteError("Task not found", 404);
}

export function validationErrorResponse(details: unknown): NextResponse {
  return NextResponse.json(
    { error: "Validation failed", details },
    { status: 400 },
  );
}

export async function getTaskRouteUser(
  request: Request,
): Promise<RouteAdapterResult<SafeUser>> {
  const user = await getAuthUserFromRequest(request);
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, value: user };
}

export async function parseTaskRouteId(
  params: TaskRouteParams["params"],
): Promise<number> {
  const { id } = await params;
  return Number(id);
}

export async function parseDependencyRouteIds(
  params: DependencyRouteParams["params"],
): Promise<{ taskId: number; dependsOnId: number }> {
  const { id, depId } = await params;
  return { taskId: Number(id), dependsOnId: Number(depId) };
}

export function findOwnedTaskOrResponse(
  db: Db,
  userId: number,
  taskId: number,
): RouteAdapterResult<Task> {
  const task = findOwnedTask(db, userId, taskId);
  if (!task) return { ok: false, response: taskNotFoundResponse() };
  return { ok: true, value: task };
}

export function taskMutationErrorResponse(error: unknown): NextResponse | null {
  if (isTaskMutationError(error)) {
    return taskRouteError(error.message, error.status);
  }
  if (error instanceof Error && error.message.includes("not found")) {
    return taskRouteError(error.message, 404);
  }
  return null;
}

export async function parseDependencyRequestBody(
  request: Request,
): Promise<RouteAdapterResult<{ dependsOnId: number }>> {
  const body = (await request.json()) as { depends_on_id?: number };

  if (!body.depends_on_id) {
    return {
      ok: false,
      response: taskRouteError("depends_on_id is required", 400),
    };
  }

  return { ok: true, value: { dependsOnId: body.depends_on_id } };
}
