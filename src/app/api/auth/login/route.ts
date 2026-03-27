import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/core/auth";
import { getUserTwoFactorMethods } from "@/core/two-factor";
import { db } from "@/db";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const { username, password } = body;

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
    password.length < 1 ||
    password.length > 128
  ) {
    return NextResponse.json(
      { error: "Invalid input length" },
      { status: 400 },
    );
  }

  recordAttempt(ip);

  const user = verifyPassword(db, username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const twoFactorMethods = getUserTwoFactorMethods(db, user.id);

  if (twoFactorMethods.length > 0) {
    const cookieStore = await cookies();
    cookieStore.set("pending_2fa_user", String(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 300,
    });

    return NextResponse.json({
      requires2FA: true,
      methods: twoFactorMethods,
    });
  }

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
}
