import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { userHasPassword, validateSession } from "@/core/auth";
import type { OAuthProvider } from "@/core/oauth";
import { getLinkedProviders } from "@/core/oauth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { db } from "@/db";

const allProviders: OAuthProvider[] = ["github", "google", "gitlab"];

function getAvailableProviders(): OAuthProvider[] {
  return allProviders.filter(
    (p) => !!process.env[`OAUTH_${p.toUpperCase()}_CLIENT_ID`],
  );
}

export default async function SettingsPage() {
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

  const linkedProviders = getLinkedProviders(db, user.id);
  const availableProviders = getAvailableProviders();
  const hasPassword = userHasPassword(db, user.id);

  return (
    <SettingsForm
      settings={settings}
      categories={categories}
      linkedProviders={linkedProviders}
      availableProviders={availableProviders}
      hasPassword={hasPassword}
    />
  );
}
