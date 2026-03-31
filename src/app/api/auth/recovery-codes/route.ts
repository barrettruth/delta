import { NextResponse } from "next/server";
import {
  generateRecoveryCodes,
  remainingRecoveryCodeCount,
} from "@/core/recovery";
import { db } from "@/db";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  return NextResponse.json({
    remaining: remainingRecoveryCodeCount(db, user.id),
  });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const codes = generateRecoveryCodes(db, user.id);
  return NextResponse.json({ codes });
}
