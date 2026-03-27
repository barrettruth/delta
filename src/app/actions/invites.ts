"use server";

import { cookies } from "next/headers";
import { generateInviteCode, validateSession } from "@/core/auth";
import { db } from "@/db";

type ActionResult<T> = { data: T } | { error: string };

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) return null;
  const user = validateSession(db, sessionId);
  return user?.id ?? null;
}

export async function generateInviteAction(): Promise<ActionResult<string>> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { error: "Not authenticated" };
    const code = generateInviteCode(db, userId);
    return { data: code };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to generate invite code",
    };
  }
}
