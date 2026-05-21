import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardContent } from "@/components/dashboard-content";
import { DashboardProviders } from "@/components/dashboard-providers";
import { GlobalKeyboard } from "@/components/global-keyboard";
import { SidebarInset } from "@/components/ui/sidebar";
import { EARLY_KEYBOARD_BUFFER_SCRIPT } from "@/lib/early-keyboard";
import { loadDashboardShellData } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { user, tasks, categories } = await loadDashboardShellData();

  return (
    <>
      <script
        id="delta-early-keyboard"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-hydration key buffer
        dangerouslySetInnerHTML={{ __html: EARLY_KEYBOARD_BUFFER_SCRIPT }}
      />
      <Suspense>
        <DashboardProviders>
          <AppSidebar username={user.username} />
          <SidebarInset className="flex flex-col h-dvh">
            <DashboardContent tasks={tasks}>
              {children}
              <GlobalKeyboard categories={categories} />
            </DashboardContent>
          </SidebarInset>
          {modal}
        </DashboardProviders>
      </Suspense>
    </>
  );
}
