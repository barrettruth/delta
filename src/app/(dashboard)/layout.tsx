import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardContent } from "@/components/dashboard-content";
import { GlobalKeyboard } from "@/components/global-keyboard";
import { NavigationWrapper } from "@/components/navigation-wrapper";
import { SidebarInset } from "@/components/ui/sidebar";
import { loadDashboardShellData } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { user, tasks, categories, categoryColors } =
    await loadDashboardShellData();

  return (
    <Suspense>
      <NavigationWrapper>
        <AppSidebar
          username={user.username}
          categories={categories}
          categoryColors={categoryColors}
        />
        <SidebarInset className="flex flex-col h-dvh">
          <DashboardContent tasks={tasks}>
            {children}
            <GlobalKeyboard categories={categories} />
          </DashboardContent>
        </SidebarInset>
        {modal}
      </NavigationWrapper>
    </Suspense>
  );
}
