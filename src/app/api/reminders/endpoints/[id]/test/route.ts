import { NextResponse } from "next/server";
import { sendReminderEndpointTest } from "@/core/reminders/dispatch";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (
    body.body !== undefined &&
    (typeof body.body !== "string" || body.body.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "body must be a non-empty string" },
      { status: 400 },
    );
  }

  try {
    const result = await sendReminderEndpointTest(db, user.id, Number(id), {
      body: body.body,
    });
    return NextResponse.json({
      ok: true,
      providerMessageId: result.providerMessageId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to test reminder endpoint";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
