import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardContent } from "@/components/dashboard-content";
import { GlobalKeyboard } from "@/components/global-keyboard";
import { NavigationWrapper } from "@/components/navigation-wrapper";
import { SidebarInset } from "@/components/ui/sidebar";
import { listCategoryColors } from "@/core/category-colors";
import { listTasks } from "@/core/task";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const user = await requireAuthUser();

  const allTasks = listTasks(db, user.id);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  const colors = listCategoryColors(db, user.id);

  return (
    <Suspense>
      <NavigationWrapper>
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
        {modal}
      </NavigationWrapper>
    </Suspense>
  );
}
