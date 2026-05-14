import { NextResponse } from "next/server";
import { disconnectGoogleIntegration } from "@/core/google/cleanup";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function DELETE(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  disconnectGoogleIntegration(db, user.id);
  return NextResponse.json({ ok: true });
}
