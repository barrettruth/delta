import { NextResponse } from "next/server";
import { listReminderDeliveryLog } from "@/core/reminders/deliveries";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateReminderDeliveryLogFilters } from "@/lib/reminder-validation";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const result = validateReminderDeliveryLogFilters(searchParams);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  return NextResponse.json(listReminderDeliveryLog(db, user.id, result.data));
}
