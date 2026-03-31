import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateRegistration,
  removeCredential,
  verifyAndSaveRegistration,
} from "@/core/webauthn";
import { db } from "@/db";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const cookieStore = await cookies();

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
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const cookieStore = await cookies();
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

export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Credential ID required" },
      { status: 400 },
    );
  }

  try {
    removeCredential(db, user.id, Number.parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to remove" },
      { status: 400 },
    );
  }
}
