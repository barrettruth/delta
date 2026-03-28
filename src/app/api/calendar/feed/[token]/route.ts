import { generateFeedIcs, getUserByFeedToken } from "@/core/calendar-feed";
import { db } from "@/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = getUserByFeedToken(db, token);

  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  const ics = generateFeedIcs(db, user.id);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="delta.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
