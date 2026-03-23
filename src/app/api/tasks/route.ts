import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/core/task";
import type { TaskFilters, TaskStatus } from "@/core/types";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateCreateTask } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const filters: TaskFilters = {};

  const status = searchParams.get("status");
  if (status) {
    filters.status = status.includes(",")
      ? (status.split(",") as TaskStatus[])
      : (status as TaskStatus);
  }

  const category = searchParams.get("category");
  if (category) filters.category = category;

  const dueBefore = searchParams.get("due_before");
  if (dueBefore) filters.dueBefore = dueBefore;

  const dueAfter = searchParams.get("due_after");
  if (dueAfter) filters.dueAfter = dueAfter;

  const minPriority = searchParams.get("min_priority");
  if (minPriority) filters.minPriority = Number(minPriority);

  const sortBy = searchParams.get("sort_by");
  if (sortBy) filters.sortBy = sortBy as TaskFilters["sortBy"];

  const sortOrder = searchParams.get("sort_order");
  if (sortOrder) filters.sortOrder = sortOrder as TaskFilters["sortOrder"];

  return NextResponse.json(listTasks(db, user.id, filters));
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const result = validateCreateTask(body);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  try {
    const task = createTask(db, user.id, result.data);
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
