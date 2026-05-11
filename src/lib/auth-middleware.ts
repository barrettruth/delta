import { NextResponse } from "next/server";
import type { SafeUser } from "@/core/auth";
import { getOrCreateLocalUser, validateApiKey } from "@/core/auth";
import { db } from "@/db";

export async function getAuthUser(): Promise<SafeUser> {
  return getOrCreateLocalUser(db);
}

export async function getAuthUserFromRequest(
  request: Request,
): Promise<SafeUser | null> {
  const authorization = request.headers.get("authorization");
  const bearer =
    authorization?.toLowerCase().startsWith("bearer ") === true
      ? authorization.slice("bearer ".length).trim()
      : null;
  const apiKey = request.headers.get("x-api-key") ?? bearer;
  if (apiKey) {
    return validateApiKey(db, apiKey);
  }

  return getOrCreateLocalUser(db);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
