import { NextResponse } from "next/server";
import { addDependency, getDependencies } from "@/core/dag";
import { getTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = getTask(db, Number(id));
  if (!task || task.userId !== user.id) {
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

  const task = getTask(db, Number(id));
  if (!task || task.userId !== user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const dep = getTask(db, body.depends_on_id);
  if (!dep || dep.userId !== user.id) {
    return NextResponse.json(
      { error: "Dependency task not found" },
      { status: 404 },
    );
  }

  try {
    addDependency(db, Number(id), body.depends_on_id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
