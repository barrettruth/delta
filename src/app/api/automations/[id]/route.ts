import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

function getOwnedAutomation(userId: number, id: number) {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, userId)))
    .get();
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = getOwnedAutomation(user.id, Number(id));
  if (!existing) {
    return NextResponse.json(
      { error: "Automation not found" },
      { status: 404 },
    );
  }

  const body = await request.json();
  if (body.config && typeof body.config !== "string") {
    body.config = JSON.stringify(body.config);
  }

  const updated = db
    .update(automations)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(automations.id, Number(id)))
    .returning()
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = getOwnedAutomation(user.id, Number(id));
  if (!existing) {
    return NextResponse.json(
      { error: "Automation not found" },
      { status: 404 },
    );
  }

  db.delete(automations)
    .where(eq(automations.id, Number(id)))
    .run();
  return NextResponse.json({ ok: true });
}
