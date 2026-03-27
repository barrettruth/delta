import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/core/auth";
import { generateAuthentication, verifyAndAuthenticate } from "@/core/webauthn";
import { db } from "@/db";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function GET() {
  const options = await generateAuthentication(db);
  const cookieStore = await cookies();

  cookieStore.set("webauthn_challenge", options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 300,
  });

  return NextResponse.json(options);
}

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

  recordAttempt(ip);

  const cookieStore = await cookies();
  const challenge = cookieStore.get("webauthn_challenge")?.value;
  cookieStore.delete("webauthn_challenge");

  if (!challenge) {
    return NextResponse.json({ error: "No challenge found" }, { status: 400 });
  }

  const body = await request.json();

  try {
    const result = await verifyAndAuthenticate(db, body, challenge);
    const sessionId = createSession(db, result.userId);

    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 },
    );
  }
}
