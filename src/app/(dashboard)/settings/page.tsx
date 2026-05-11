import { AccountSection } from "@/components/settings/account-section";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsAccountPage() {
  const user = await requireAuthUser();

  return <AccountSection username={user.username} apiKey={user.apiKey} />;
}
