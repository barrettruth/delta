import { NextResponse } from "next/server";
import { listReminderAdapters } from "@/core/reminders/registry";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  return NextResponse.json(listReminderAdapters());
}
