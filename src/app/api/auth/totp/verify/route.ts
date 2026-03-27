import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/core/auth";
import { verifyRecoveryCode } from "@/core/recovery";
import { getTotpSecret, verifyTotpToken } from "@/core/totp";
import { db } from "@/db";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pendingUserId = cookieStore.get("pending_2fa_user")?.value;

  if (!pendingUserId) {
    return NextResponse.json(
      { error: "No pending 2FA verification" },
      { status: 400 },
    );
  }

  const userId = Number.parseInt(pendingUserId, 10);
  const { token, isRecoveryCode } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  if (isRecoveryCode) {
    if (!verifyRecoveryCode(db, userId, token)) {
      return NextResponse.json(
        { error: "Invalid recovery code" },
        { status: 401 },
      );
    }
  } else {
    const secret = getTotpSecret(db, userId);
    if (!secret) {
      return NextResponse.json(
        { error: "TOTP not configured" },
        { status: 400 },
      );
    }

    if (!verifyTotpToken(secret, token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  cookieStore.delete("pending_2fa_user");
  const sessionId = createSession(db, userId);
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true });
}
