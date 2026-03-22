import { NextResponse } from "next/server";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  return NextResponse.json(db.select().from(automations).all());
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.name || !body.cron || !body.type || !body.config) {
    return NextResponse.json(
      { error: "name, cron, type, and config are required" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const automation = db
    .insert(automations)
    .values({
      name: body.name,
      cron: body.cron,
      type: body.type,
      config:
        typeof body.config === "string"
          ? body.config
          : JSON.stringify(body.config),
      enabled: body.enabled ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return NextResponse.json(automation, { status: 201 });
}
