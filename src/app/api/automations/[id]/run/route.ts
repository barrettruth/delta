import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { runAutomation } from "@/core/automation";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = db
    .select()
    .from(automations)
    .where(and(eq(automations.id, Number(id)), eq(automations.userId, user.id)))
    .get();

  if (!existing) {
    return NextResponse.json(
      { error: "Automation not found" },
      { status: 404 },
    );
  }

  try {
    await runAutomation(db, Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
