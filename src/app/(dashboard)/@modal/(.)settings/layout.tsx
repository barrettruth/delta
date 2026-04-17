import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsModalShell } from "@/components/settings-modal-shell";
import { validateSession } from "@/core/auth";
import { db } from "@/db";

export default async function InterceptedSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  return <SettingsModalShell>{children}</SettingsModalShell>;
}
