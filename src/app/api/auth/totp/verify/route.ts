import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/core/auth";
import { verifyRecoveryCode } from "@/core/recovery";
import { getTotpSecret, verifyTotpToken } from "@/core/totp";
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

  const cookieStore = await cookies();
  const pendingUserId = cookieStore.get("pending_2fa_user")?.value;

  if (!pendingUserId) {
    return NextResponse.json(
      { error: "No pending 2FA verification" },
      { status: 400 },
    );
  }

  const userId = Number.parseInt(pendingUserId, 10);
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  recordAttempt(ip);

  let verified = false;

  const secret = getTotpSecret(db, userId);
  if (secret && verifyTotpToken(secret, token)) {
    verified = true;
  }

  if (!verified && token.includes("-")) {
    if (verifyRecoveryCode(db, userId, token)) {
      verified = true;
    }
  }

  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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
