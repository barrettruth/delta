import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardContent } from "@/components/dashboard-content";
import { GlobalKeyboard } from "@/components/global-keyboard";
import { MessageBar } from "@/components/keyboard-hints";
import { NavigationWrapper } from "@/components/navigation-wrapper";
import { SidebarInset } from "@/components/ui/sidebar";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
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

  const settings = getSettings(db, user.id);
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

  return (
    <Suspense>
      <NavigationWrapper>
        <AppSidebar categories={categories} categoryColors={colors} />
        <SidebarInset className="flex flex-col h-dvh">
          <DashboardContent tasks={allTasks}>{children}</DashboardContent>
          <MessageBar />
        </SidebarInset>
        <GlobalKeyboard
          categories={categories}
          defaultCategory={settings.defaultCategory}
          tasks={allTasks}
        />
      </NavigationWrapper>
    </Suspense>
  );
}
