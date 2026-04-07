import { NextResponse } from "next/server";
import { getReminderDeliveryLogEntry } from "@/core/reminders/deliveries";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const delivery = getReminderDeliveryLogEntry(db, user.id, Number(id));

  if (!delivery) {
    return NextResponse.json(
      { error: "Reminder delivery not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(delivery);
}
