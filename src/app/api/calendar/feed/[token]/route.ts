import { createHash } from "node:crypto";
import {
  generateFeedIcs,
  getLastModified,
  getUserByFeedToken,
} from "@/core/calendar-feed";
import { db } from "@/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = getUserByFeedToken(db, token);

  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  const lastModified = getLastModified(db, user.id);
  const lastModifiedStr = lastModified
    ? lastModified.toUTCString()
    : new Date(0).toUTCString();

  const ifModifiedSince = request.headers.get("If-Modified-Since");
  if (ifModifiedSince && lastModified) {
    const clientDate = new Date(ifModifiedSince);
    if (lastModified <= clientDate) {
      return new Response(null, { status: 304 });
    }
  }

  const ics = generateFeedIcs(db, user.id);
  const etag = `"${createHash("md5").update(ics).digest("hex")}"`;

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="delta.ics"',
      "Cache-Control": "no-cache, must-revalidate",
      ETag: etag,
      "Last-Modified": lastModifiedStr,
    },
  });
}
