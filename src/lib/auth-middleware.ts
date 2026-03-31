import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SafeUser } from "@/core/auth";
import { validateApiKey, validateSession } from "@/core/auth";
import { db } from "@/db";

export async function getAuthUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (sessionId) {
    return validateSession(db, sessionId);
  }

  return null;
}

export async function getAuthUserFromRequest(
  request: Request,
): Promise<SafeUser | null> {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    return validateApiKey(db, apiKey);
  }

  return getAuthUser();
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
