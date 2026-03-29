import { NextResponse } from "next/server";
import { importICalEvents } from "@/core/ical/import";
import { parseICalendar } from "@/core/ical/parser";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing .ics file in 'file' field" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 5MB limit" },
      { status: 400 },
    );
  }

  const content = await file.text();

  let events: Awaited<ReturnType<typeof parseICalendar>>;
  try {
    events = await parseICalendar(content);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse iCal content" },
      { status: 400 },
    );
  }

  const category = (formData.get("category") as string | null) ?? undefined;

  try {
    const result = importICalEvents(db, user.id, events, category);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
