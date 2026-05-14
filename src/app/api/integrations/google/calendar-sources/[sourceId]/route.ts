import { NextResponse } from "next/server";
import { setGoogleCalendarSourceEnabled } from "@/core/google/calendar-sources";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

type Params = { params: Promise<{ sourceId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const { sourceId } = await params;
  const id = Number(sourceId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid source id" }, { status: 400 });
  }

  const body = (await request.json()) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  const source = setGoogleCalendarSourceEnabled(db, user.id, id, body.enabled);
  if (!source) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  return NextResponse.json(source);
}
