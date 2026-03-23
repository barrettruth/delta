"use server";

import { cookies } from "next/headers";
import { validateSession } from "@/core/auth";
import {
  getLinkedProviders,
  type OAuthProvider,
  unlinkAccount,
} from "@/core/oauth";
import { db } from "@/db";

type ActionResult<T> = { data: T } | { error: string };

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) return null;
  const user = validateSession(db, sessionId);
  return user?.id ?? null;
}

export async function getLinkedProvidersAction(): Promise<
  ActionResult<OAuthProvider[]>
> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { error: "Not authenticated" };
    return { data: getLinkedProviders(db, userId) };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to get linked providers",
    };
  }
}

export async function unlinkAccountAction(
  provider: OAuthProvider,
): Promise<ActionResult<null>> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { error: "Not authenticated" };
    unlinkAccount(db, userId, provider);
    return { data: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to unlink account",
    };
  }
}
