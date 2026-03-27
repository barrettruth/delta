import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/core/auth";
import { userHas2FA } from "@/core/two-factor";
import { db } from "@/db";
import { SetupTwoFactor } from "./setup-two-factor";

export default async function SetupTwoFactorPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  if (userHas2FA(db, user.id)) redirect("/");

  return <SetupTwoFactor username={user.username} />;
}
