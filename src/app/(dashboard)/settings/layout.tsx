import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { validateSession } from "@/core/auth";
import { db } from "@/db";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <SettingsSidebar username={user.username} />
      <div className="min-w-0 flex-1 overflow-y-auto bg-background/40">
        {children}
      </div>
    </div>
  );
}
