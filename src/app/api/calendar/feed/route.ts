import { NextResponse } from "next/server";
import {
  generateFeedToken,
  getFeedToken,
  revokeFeedToken,
} from "@/core/calendar-feed";
import { db } from "@/db";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const token = getFeedToken(db, user.id);
  return NextResponse.json({ token });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const token = generateFeedToken(db, user.id);
  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  revokeFeedToken(db, user.id);
  return NextResponse.json({ token: null });
}
