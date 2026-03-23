"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { validateSession } from "@/core/auth";
import {
  getSettings,
  type UserSettings,
  updateSettings,
} from "@/core/settings";
import { db } from "@/db";

type ActionResult<T> = { data: T } | { error: string };

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) return null;
  const user = validateSession(db, sessionId);
  return user?.id ?? null;
}

export async function getSettingsAction(): Promise<ActionResult<UserSettings>> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { error: "Not authenticated" };
    return { data: getSettings(db, userId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to get settings" };
  }
}

export async function updateSettingsAction(
  partial: Partial<UserSettings>,
): Promise<ActionResult<UserSettings>> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { error: "Not authenticated" };
    const settings = updateSettings(db, userId, partial);
    revalidatePath("/");
    return { data: settings };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to update settings",
    };
  }
}
