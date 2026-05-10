import { PreferencesSection } from "@/components/settings/preferences-section";
import { getSettings } from "@/core/settings";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsPreferencesPage() {
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);

  return <PreferencesSection settings={settings} />;
}
