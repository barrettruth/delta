import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { DEFAULT_KEYMAPS } from "@/lib/keymap-defs";

const keymapIndex = new Map(DEFAULT_KEYMAPS.map((d) => [d.id, d]));

const BROWSER_RESERVED = new Set([
  "ctrl+w",
  "ctrl+t",
  "ctrl+n",
  "ctrl+Tab",
  "F1",
  "F3",
  "F5",
  "F11",
  "F12",
]);

function isBrowserReserved(triggerKey: string, modifiers?: string[]): boolean {
  if (modifiers?.includes("ctrl")) {
    const combo = `ctrl+${triggerKey}`;
    if (BROWSER_RESERVED.has(combo)) return true;
  }
  return BROWSER_RESERVED.has(triggerKey);
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const row = db
    .select({ keymapOverrides: users.keymapOverrides })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  const overrides = row?.keymapOverrides ? JSON.parse(row.keymapOverrides) : {};

  return NextResponse.json(overrides);
}

export async function PUT(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { overrides } = body as { overrides: Record<string, string> };

  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return NextResponse.json(
      { error: "overrides must be an object" },
      { status: 400 },
    );
  }

  for (const [id, triggerKey] of Object.entries(overrides)) {
    const def = keymapIndex.get(id);
    if (!def) {
      return NextResponse.json(
        { error: `unknown keymap id: ${id}` },
        { status: 400 },
      );
    }

    if (def.configurable === false) {
      return NextResponse.json(
        { error: `keymap ${id} is not configurable` },
        { status: 400 },
      );
    }

    if (
      typeof triggerKey !== "string" ||
      triggerKey.length === 0 ||
      triggerKey.length > 32
    ) {
      return NextResponse.json(
        { error: `invalid key value for ${id}` },
        { status: 400 },
      );
    }

    if (isBrowserReserved(triggerKey, def.modifiers)) {
      return NextResponse.json(
        { error: `${triggerKey} is a browser-reserved key` },
        { status: 400 },
      );
    }
  }

  const serialized =
    Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null;

  db.update(users)
    .set({ keymapOverrides: serialized })
    .where(eq(users.id, user.id))
    .run();

  return NextResponse.json(overrides);
}
