import { NextResponse } from "next/server";
import { regenerateApiKey } from "@/core/auth";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function POST(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const apiKey = regenerateApiKey(db, user.id);
  return NextResponse.json({ apiKey, token: apiKey });
}
