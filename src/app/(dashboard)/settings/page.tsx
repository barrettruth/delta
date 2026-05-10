import { AccountSection } from "@/components/settings/account-section";
import { getLinkedAccounts } from "@/core/oauth";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsAccountPage() {
  const user = await requireAuthUser();
  const connectedAccounts = getLinkedAccounts(db, user.id);

  return (
    <AccountSection
      username={user.username}
      connectedAccounts={connectedAccounts}
    />
  );
}
