import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateInviteToken } from "@/core/auth";
import { db } from "@/db";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = validateInviteToken(db, token);

  if (!invite) {
    redirect("/login?error=invalid_invite");
  }

  const cookieStore = await cookies();
  cookieStore.set("invite_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  redirect("/login");
}
