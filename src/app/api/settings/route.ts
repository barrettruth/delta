import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  getSettings,
  type UserSettings,
  updateSettings,
} from "@/core/settings";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  return NextResponse.json(getSettings(db, user.id));
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { username: newUsername, ...partial } =
    body as Partial<UserSettings> & {
      username?: string;
    };

  if (newUsername !== undefined) {
    const trimmed = newUsername.trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "Username cannot be empty" },
        { status: 400 },
      );
    }
    const existing = db
      .select()
      .from(users)
      .where(eq(users.username, trimmed))
      .get();
    if (existing && existing.id !== user.id) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 },
      );
    }
    db.update(users)
      .set({ username: trimmed })
      .where(eq(users.id, user.id))
      .run();
  }

  const updated =
    Object.keys(partial).length > 0
      ? updateSettings(db, user.id, partial)
      : getSettings(db, user.id);
  return NextResponse.json({
    ...updated,
    ...(newUsername !== undefined ? { username: newUsername.trim() } : {}),
  });
}
