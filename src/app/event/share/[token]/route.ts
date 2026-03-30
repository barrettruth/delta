import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/core/auth";
import { acceptShareLink, validateShareLink } from "@/core/event-share";
import { db } from "@/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const link = validateShareLink(db, token);

  if (!link) {
    redirect("/login?error=invalid_share_link");
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  const user = sessionId ? validateSession(db, sessionId) : null;

  if (user) {
    try {
      acceptShareLink(db, user.id, token);
    } catch {
      // source gone or other error — just redirect
    }
    redirect("/calendar");
  }

  cookieStore.set("share_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  redirect("/login");
}
