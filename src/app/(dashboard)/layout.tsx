import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardContent } from "@/components/dashboard-content";
import { GlobalKeyboard } from "@/components/global-keyboard";
import { NavigationWrapper } from "@/components/navigation-wrapper";
import { SidebarInset } from "@/components/ui/sidebar";
import { validateSession } from "@/core/auth";
import { listTasks } from "@/core/task";
import { userHas2FA } from "@/core/two-factor";
import { db } from "@/db";
import { categoryColors } from "@/db/schema";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  if (!userHas2FA(db, user.id)) redirect("/setup-2fa");
  if (!user.onboardingCompleted) redirect("/onboarding");

  const allTasks = listTasks(db, user.id);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  const colors = Object.fromEntries(
    db
      .select()
      .from(categoryColors)
      .where(eq(categoryColors.userId, user.id))
      .all()
      .map((c) => [c.category, c.color]),
  );

  const keymapOverrides: Record<string, string> = user.keymapOverrides
    ? JSON.parse(user.keymapOverrides)
    : {};

  return (
    <Suspense>
      <NavigationWrapper keymapOverrides={keymapOverrides}>
        <AppSidebar
          username={user.username}
          categories={categories}
          categoryColors={colors}
        />
        <SidebarInset className="flex flex-col h-dvh">
          <DashboardContent tasks={allTasks}>
            {children}
            <GlobalKeyboard categories={categories} />
          </DashboardContent>
        </SidebarInset>
      </NavigationWrapper>
    </Suspense>
  );
}
