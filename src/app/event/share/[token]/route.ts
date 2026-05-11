import { redirect } from "next/navigation";
import { acceptShareLink, validateShareLink } from "@/core/event-share";
import { db } from "@/db";
import { getAuthUser } from "@/lib/auth-middleware";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const link = validateShareLink(db, token);

  if (!link) {
    redirect("/calendar");
  }

  const user = await getAuthUser();

  try {
    acceptShareLink(db, user.id, token);
  } catch {
    // source gone or other error, just return to the calendar
  }

  redirect("/calendar");
}
