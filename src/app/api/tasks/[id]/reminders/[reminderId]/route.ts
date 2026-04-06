import { NextResponse } from "next/server";
import { getReminderEndpoint } from "@/core/reminders/endpoints";
import {
  deleteTaskReminder,
  getTaskReminder,
  updateTaskReminder,
} from "@/core/reminders/rules";
import { getTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateUpdateTaskReminder } from "@/lib/reminder-validation";

type Params = { params: Promise<{ id: string; reminderId: string }> };

function taskNotFound() {
  return NextResponse.json({ error: "Task not found" }, { status: 404 });
}

function reminderNotFound() {
  return NextResponse.json(
    { error: "Task reminder not found" },
    { status: 404 },
  );
}

function endpointNotFound() {
  return NextResponse.json(
    { error: "Reminder endpoint not found" },
    { status: 404 },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id, reminderId } = await params;
  const taskId = Number(id);
  const task = getTask(db, taskId);
  if (!task || task.userId !== user.id) {
    return taskNotFound();
  }

  const reminder = getTaskReminder(db, user.id, Number(reminderId));
  if (!reminder || reminder.taskId !== taskId) {
    return reminderNotFound();
  }

  const body = await request.json();
  const result = validateUpdateTaskReminder(body);
  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  if (result.data.endpointId !== undefined) {
    const endpoint = getReminderEndpoint(db, user.id, result.data.endpointId);
    if (!endpoint) {
      return endpointNotFound();
    }
  }

  const updated = updateTaskReminder(db, user.id, reminder.id, result.data);
  if (!updated || updated.taskId !== taskId) {
    return reminderNotFound();
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id, reminderId } = await params;
  const taskId = Number(id);
  const task = getTask(db, taskId);
  if (!task || task.userId !== user.id) {
    return taskNotFound();
  }

  const reminder = getTaskReminder(db, user.id, Number(reminderId));
  if (!reminder || reminder.taskId !== taskId) {
    return reminderNotFound();
  }

  const deleted = deleteTaskReminder(db, user.id, reminder.id);
  if (!deleted) {
    return reminderNotFound();
  }

  return NextResponse.json({ ok: true });
}
