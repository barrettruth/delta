import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  consumeInviteCode,
  createSession,
  createUser,
  validateInviteCode,
} from "@/core/auth";
import { db } from "@/db";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const { username, password, inviteCode } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 },
    );
  }

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length < 1 ||
    username.length > 50 ||
    password.length > 128
  ) {
    return NextResponse.json(
      { error: "Invalid input length" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  if (!inviteCode) {
    return NextResponse.json(
      { error: "Invite code required" },
      { status: 400 },
    );
  }

  recordAttempt(ip);

  if (!validateInviteCode(db, inviteCode)) {
    return NextResponse.json(
      { error: "Invalid or already used invite code" },
      { status: 400 },
    );
  }

  try {
    const user = createUser(db, username, password);
    consumeInviteCode(db, inviteCode, user.id);

    const sessionId = createSession(db, user.id);
    const cookieStore = await cookies();
    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ user });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
