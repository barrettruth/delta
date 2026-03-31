import { NextResponse } from "next/server";
import { syncGoogleCalendar } from "@/core/google-calendar-sync";
import { db } from "@/db";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const result = await syncGoogleCalendar(db, user.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[calendar sync]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}
