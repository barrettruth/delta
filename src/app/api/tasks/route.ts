import { NextResponse } from "next/server";
import { listTasks } from "@/core/task";
import {
  parseTaskFilters,
  taskFilterParamsFromSearchParams,
} from "@/core/task-filters";
import { db } from "@/db";
import { validateCreateTask } from "@/lib/validation";
import { createTaskForUser } from "@/server/task-mutations";
import {
  getTaskRouteUser,
  taskRouteError,
  validationErrorResponse,
} from "./route-adapters";

export async function GET(request: Request) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const { searchParams } = new URL(request.url);
  const filters = parseTaskFilters(
    taskFilterParamsFromSearchParams(searchParams),
  );

  return NextResponse.json(listTasks(db, user.id, filters));
}

export async function POST(request: Request) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const body = await request.json();
  const result = validateCreateTask(body);

  if (!result.success || !result.data) {
    return validationErrorResponse(result.errors);
  }

  try {
    const task = createTaskForUser(db, user.id, result.data);
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create task";
    return taskRouteError(message, 500);
  }
}
