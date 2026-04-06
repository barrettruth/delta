import { NextResponse } from "next/server";
import { getReminderEndpoint } from "@/core/reminders/endpoints";
import { createTaskReminder, listTaskReminders } from "@/core/reminders/rules";
import { getTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateCreateTaskReminder } from "@/lib/reminder-validation";

type Params = { params: Promise<{ id: string }> };

function taskNotFound() {
  return NextResponse.json({ error: "Task not found" }, { status: 404 });
}

function endpointNotFound() {
  return NextResponse.json(
    { error: "Reminder endpoint not found" },
    { status: 404 },
  );
}

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = getTask(db, Number(id));
  if (!task || task.userId !== user.id) {
    return taskNotFound();
  }

  return NextResponse.json(listTaskReminders(db, user.id, task.id));
}

export async function POST(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const taskId = Number(id);
  const task = getTask(db, taskId);
  if (!task || task.userId !== user.id) {
    return taskNotFound();
  }

  const body = await request.json();
  const result = validateCreateTaskReminder(body);
  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  const endpoint = getReminderEndpoint(db, user.id, result.data.endpointId);
  if (!endpoint) {
    return endpointNotFound();
  }

  try {
    const reminder = createTaskReminder(db, user.id, {
      taskId,
      endpointId: result.data.endpointId,
      anchor: result.data.anchor,
      offsetMinutes: result.data.offsetMinutes,
      allDayLocalTime: result.data.allDayLocalTime,
      enabled: result.data.enabled,
    });
    return NextResponse.json(reminder, { status: 201 });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create task reminder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
