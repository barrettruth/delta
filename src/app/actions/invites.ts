"use server";

import { cookies } from "next/headers";
import {
  generateInviteLink,
  listInviteLinks,
  validateSession,
} from "@/core/auth";
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
    const token = generateInviteLink(db, userId);
    return { data: token };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to generate invite link",
    };
  }
}

export type InviteLinkRow = {
  id: number;
  token: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  createdAt: string;
};

export async function listInvitesAction(): Promise<
  ActionResult<InviteLinkRow[]>
> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { error: "Not authenticated" };
    const rows = listInviteLinks(db, userId);
    return {
      data: rows.map((r) => ({
        id: r.id,
        token: r.token,
        expiresAt: r.expiresAt,
        maxUses: r.maxUses,
        useCount: r.useCount,
        createdAt: r.createdAt,
      })),
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to list invites",
    };
  }
}
