import { NextResponse } from "next/server";
import {
  generateFeedToken,
  getFeedToken,
  revokeFeedToken,
} from "@/core/calendar-feed";
import { db } from "@/db";
import { getLocalOwner } from "@/lib/local-owner";

export async function GET() {
  const user = await getLocalOwner();

  const token = getFeedToken(db, user.id);
  return NextResponse.json({ token });
}

export async function POST() {
  const user = await getLocalOwner();

  const token = generateFeedToken(db, user.id);
  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await getLocalOwner();

  revokeFeedToken(db, user.id);
  return NextResponse.json({ token: null });
}
