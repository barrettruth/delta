import { NextResponse } from "next/server";
import {
  deleteReminderEndpoint,
  getReminderEndpoint,
  updateReminderEndpoint,
} from "@/core/reminders/endpoints";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateUpdateReminderEndpoint } from "@/lib/reminder-validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const endpoint = getReminderEndpoint(db, user.id, Number(id));
  if (!endpoint) {
    return NextResponse.json(
      { error: "Reminder endpoint not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(endpoint);
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const endpointId = Number(id);
  const existing = getReminderEndpoint(db, user.id, endpointId);
  if (!existing) {
    return NextResponse.json(
      { error: "Reminder endpoint not found" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const result = validateUpdateReminderEndpoint(body);
  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  const endpoint = updateReminderEndpoint(db, user.id, endpointId, result.data);
  if (!endpoint) {
    return NextResponse.json(
      { error: "Reminder endpoint not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(endpoint);
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const deleted = deleteReminderEndpoint(db, user.id, Number(id));
  if (!deleted) {
    return NextResponse.json(
      { error: "Reminder endpoint not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
