import { NextResponse } from "next/server";
import { listTasks } from "@/core/task";
import {
  parseTaskFilters,
  taskFilterParamsFromSearchParams,
} from "@/core/task-filters";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateCreateTask } from "@/lib/validation";
import { createTaskForUser } from "@/server/task-mutations";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const filters = parseTaskFilters(
    taskFilterParamsFromSearchParams(searchParams),
  );

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
    const task = createTaskForUser(db, user.id, result.data);
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
