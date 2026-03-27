import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/core/auth";
import {
  getSettings,
  updateSettings,
  type UserSettings,
} from "@/core/settings";
import { db } from "@/db";

async function getUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) return null;
  return validateSession(db, sessionId);
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(getSettings(db, user.id));
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const partial: Partial<UserSettings> = await request.json();
  const updated = updateSettings(db, user.id, partial);
  return NextResponse.json(updated);
}
