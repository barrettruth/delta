"use server";

import { revalidatePath } from "next/cache";
import {
  getSettings,
  type UserSettings,
  updateSettings,
} from "@/core/settings";
import { db } from "@/db";
import { getLocalOwner } from "@/lib/local-owner";

type ActionResult<T> = { data: T } | { error: string };

async function getAuthenticatedUserId(): Promise<number> {
  const user = await getLocalOwner();
  return user.id;
}

export async function getSettingsAction(): Promise<ActionResult<UserSettings>> {
  try {
    const userId = await getAuthenticatedUserId();
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
    const settings = updateSettings(db, userId, partial);
    revalidatePath("/");
    return { data: settings };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to update settings",
    };
  }
}
