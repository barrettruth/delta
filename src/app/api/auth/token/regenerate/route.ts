import { NextResponse } from "next/server";
import { regenerateApiKey } from "@/core/auth";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const apiKey = regenerateApiKey(db, user.id);
  return NextResponse.json({ apiKey });
}
