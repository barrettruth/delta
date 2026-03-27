import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/core/auth";
import { remainingRecoveryCodeCount } from "@/core/recovery";
import { getSettings } from "@/core/settings";
import { userHasTotp } from "@/core/totp";
import { getCredentialsForUser } from "@/core/webauthn";
import { db } from "@/db";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const settings = getSettings(db, user.id);
  const passkeys = getCredentialsForUser(db, user.id).map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
  }));
  const totpEnabled = userHasTotp(db, user.id);
  const recoveryCodesRemaining = remainingRecoveryCodeCount(db, user.id);

  return (
    <SettingsView
      username={user.username}
      passkeys={passkeys}
      totpEnabled={totpEnabled}
      recoveryCodesRemaining={recoveryCodesRemaining}
      settings={settings}
    />
  );
}
