import { NextResponse } from "next/server";
import { tasksToICalendar } from "@/core/ical/serializer";
import { getTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = getTask(db, Number(id));

  if (!task || task.userId !== user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.startAt) {
    return NextResponse.json(
      { error: "Task has no calendar date" },
      { status: 400 },
    );
  }

  const ical = tasksToICalendar([task], "delta");

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="delta-event-${id}.ics"`,
    },
  });
}
