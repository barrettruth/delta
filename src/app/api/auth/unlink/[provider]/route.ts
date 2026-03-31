import { NextResponse } from "next/server";
import {
  getEnabledProviders,
  type OAuthProvider,
  unlinkAccount,
} from "@/core/oauth";
import { db } from "@/db";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

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
