import { NextResponse } from "next/server";
import { GOOGLE_PROVIDER } from "@/core/google/types";
import { deleteIntegrationConfig } from "@/core/integration-config";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function DELETE(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  deleteIntegrationConfig(db, user.id, GOOGLE_PROVIDER);
  return NextResponse.json({ ok: true });
}
