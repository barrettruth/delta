import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { validateSession } from "@/core/auth";
import { enableTotp, generateTotpSecret, verifyTotpToken } from "@/core/totp";
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

  const { secret, uri } = generateTotpSecret(user.username);
  const qrCode = await QRCode.toDataURL(uri);

  cookieStore.set("totp_setup_secret", secret, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.json({ qrCode, secret, uri });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = validateSession(db, sessionId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const secret = cookieStore.get("totp_setup_secret")?.value;
  if (!secret) {
    return NextResponse.json(
      { error: "No TOTP setup in progress" },
      { status: 400 },
    );
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  if (!verifyTotpToken(secret, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  cookieStore.delete("totp_setup_secret");
  enableTotp(db, user.id, secret);

  return NextResponse.json({ success: true });
}
