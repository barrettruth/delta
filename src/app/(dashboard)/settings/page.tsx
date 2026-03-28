import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/core/auth";
import { getFeedToken } from "@/core/calendar-feed";
import { getEnabledProviders, getLinkedAccounts } from "@/core/oauth";
import { remainingRecoveryCodeCount } from "@/core/recovery";
import { isOAuthProviderConfigured } from "@/core/system-config";
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

  const passkeys = getCredentialsForUser(db, user.id).map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
  }));
  const totpEnabled = userHasTotp(db, user.id);
  const recoveryCodesRemaining = remainingRecoveryCodeCount(db, user.id);
  const calendarFeedToken = getFeedToken(db, user.id);
  const connectedAccounts = getLinkedAccounts(db, user.id);
  const enabledProviders = getEnabledProviders(db);

  const oauthProviders = {
    github: isOAuthProviderConfigured(db, "github"),
    google: isOAuthProviderConfigured(db, "google"),
  };

  return (
    <SettingsView
      username={user.username}
      passkeys={passkeys}
      totpEnabled={totpEnabled}
      recoveryCodesRemaining={recoveryCodesRemaining}
      calendarFeedToken={calendarFeedToken}
      connectedAccounts={connectedAccounts}
      enabledProviders={enabledProviders}
      oauthProviders={oauthProviders}
    />
  );
}
