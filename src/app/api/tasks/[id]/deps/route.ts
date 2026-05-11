import { NextResponse } from "next/server";
import { getDependencies } from "@/core/dag";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import {
  addDependencyForUser,
  findOwnedTask,
  isTaskMutationError,
} from "@/server/task-mutations";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = findOwnedTask(db, user.id, Number(id));
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(getDependencies(db, Number(id)));
}

export async function POST(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  if (!body.depends_on_id) {
    return NextResponse.json(
      { error: "depends_on_id is required" },
      { status: 400 },
    );
  }

  try {
    addDependencyForUser(db, user.id, Number(id), body.depends_on_id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (isTaskMutationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
