import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/core/auth";
import {
  generateRegistration,
  verifyAndSaveRegistration,
} from "@/core/webauthn";
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

  const options = await generateRegistration(db, user.id, user.username);

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
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = validateSession(db, sessionId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const challenge = cookieStore.get("webauthn_challenge")?.value;
  cookieStore.delete("webauthn_challenge");

  if (!challenge) {
    return NextResponse.json({ error: "No challenge found" }, { status: 400 });
  }

  const body = await request.json();
  const { name, response } = body;

  if (!name || !response) {
    return NextResponse.json(
      { error: "Name and response required" },
      { status: 400 },
    );
  }

  try {
    await verifyAndSaveRegistration(db, user.id, name, response, challenge);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Registration verification failed" },
      { status: 400 },
    );
  }
}
