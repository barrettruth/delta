import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalKeyboard } from "@/components/global-keyboard";
import { KeyboardHints } from "@/components/keyboard-hints";
import { SidebarInset } from "@/components/ui/sidebar";
import { validateSession } from "@/core/auth";
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

  const allTasks = listTasks(db);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  const colors = Object.fromEntries(
    db
      .select()
      .from(categoryColors)
      .all()
      .map((c) => [c.category, c.color]),
  );

  return (
    <Suspense>
      <AppSidebar categories={categories} categoryColors={colors} />
      <SidebarInset className="flex flex-col h-dvh">
        <main className="flex-1 overflow-hidden bg-background">{children}</main>
        <KeyboardHints />
      </SidebarInset>
      <GlobalKeyboard categories={categories} />
    </Suspense>
  );
}
