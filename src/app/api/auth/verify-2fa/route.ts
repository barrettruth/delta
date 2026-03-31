import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/core/auth";
import { verifyRecoveryCode } from "@/core/recovery";
import { getTotpSecret, verifyTotpToken } from "@/core/totp";
import { verifyAndAuthenticate } from "@/core/webauthn";
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
  const pendingUserId = cookieStore.get("pending_2fa")?.value;

  if (!pendingUserId) {
    return NextResponse.json(
      { error: "No pending 2FA verification" },
      { status: 400 },
    );
  }

  const userId = Number.parseInt(pendingUserId, 10);
  const body = await request.json();
  const { type } = body;

  recordAttempt(ip);

  if (type === "passkey") {
    const { credential } = body;
    const challenge = cookieStore.get("webauthn_challenge")?.value;
    cookieStore.delete("webauthn_challenge");

    if (!challenge || !credential) {
      return NextResponse.json(
        { error: "Missing challenge or credential" },
        { status: 400 },
      );
    }

    try {
      const result = await verifyAndAuthenticate(db, credential, challenge);
      if (result.userId !== userId) {
        return NextResponse.json(
          { error: "Credential does not match user" },
          { status: 401 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 401 },
      );
    }
  } else if (type === "totp") {
    const { code } = body;
    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    let verified = false;

    const secret = getTotpSecret(db, userId);
    if (secret && verifyTotpToken(secret, code)) {
      verified = true;
    }

    if (!verified && code.includes("-")) {
      if (verifyRecoveryCode(db, userId, code)) {
        verified = true;
      }
    }

    if (!verified) {
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }
  } else {
    return NextResponse.json(
      { error: "Invalid verification type" },
      { status: 400 },
    );
  }

  cookieStore.delete("pending_2fa");
  const sessionId = createSession(db, userId);
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  const shareToken = cookieStore.get("share_token")?.value;
  if (shareToken) {
    try {
      const { acceptShareLink } = await import("@/core/event-share");
      acceptShareLink(db, userId, shareToken);
    } catch (err) {
      console.error("[verify-2fa] share link accept failed", err);
    }
    cookieStore.delete("share_token");
  }

  return NextResponse.json({
    success: true,
    redirect: shareToken ? "/calendar" : undefined,
  });
}
