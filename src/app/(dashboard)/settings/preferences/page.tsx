import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PreferencesSection } from "@/components/settings/preferences-section";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { db } from "@/db";

export default async function SettingsPreferencesPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const settings = getSettings(db, user.id);

  return <PreferencesSection settings={settings} />;
}
