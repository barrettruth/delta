import { NextResponse } from "next/server";
import {
  createReminderEndpoint,
  listReminderEndpoints,
} from "@/core/reminders/endpoints";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateCreateReminderEndpoint } from "@/lib/reminder-validation";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  return NextResponse.json(listReminderEndpoints(db, user.id));
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const result = validateCreateReminderEndpoint(body);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  try {
    const endpoint = createReminderEndpoint(db, user.id, result.data);
    return NextResponse.json(endpoint, { status: 201 });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create reminder endpoint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
