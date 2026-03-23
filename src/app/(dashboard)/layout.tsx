import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardHints } from "@/components/keyboard-hints";
import { LogoutButton } from "@/components/logout-button";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { validateSession } from "@/core/auth";
import { listTasks } from "@/core/task";
import { db } from "@/db";

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

  const allTasks = listTasks(db);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  return (
    <Suspense>
      <AppSidebar categories={categories} />
      <SidebarInset className="flex flex-col h-dvh">
        <header className="flex items-center gap-2 px-4 h-12 border-b border-border/60 shrink-0">
          <SidebarTrigger className="hover:bg-accent transition-colors rounded-md" />
          <div className="flex-1" />
          <LogoutButton />
        </header>
        <main className="flex-1 overflow-hidden bg-background">{children}</main>
        <KeyboardHints />
      </SidebarInset>
    </Suspense>
  );
}
