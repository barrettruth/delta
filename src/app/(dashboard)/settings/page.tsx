import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");
  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const settings = getSettings(db, user.id);
  const allTasks = listTasks(db);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  return <SettingsForm settings={settings} categories={categories} />;
}
