import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/core/auth";
import {
  generateRecoveryCodes,
  remainingRecoveryCodeCount,
} from "@/core/recovery";
import { db } from "@/db";

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = validateSession(db, sessionId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    remaining: remainingRecoveryCodeCount(db, user.id),
  });
}

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = validateSession(db, sessionId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const codes = generateRecoveryCodes(db, user.id);
  return NextResponse.json({ codes });
}
