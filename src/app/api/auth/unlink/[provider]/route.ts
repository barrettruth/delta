import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/core/auth";
import {
  getEnabledProviders,
  type OAuthProvider,
  unlinkAccount,
} from "@/core/oauth";
import { db } from "@/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = validateSession(db, sessionId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { provider } = await params;
  const enabled = getEnabledProviders(db);

  if (!enabled.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { error: "Unknown or disabled provider" },
      { status: 400 },
    );
  }

  const result = unlinkAccount(db, user.id, provider as OAuthProvider);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
