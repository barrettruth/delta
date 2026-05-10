import { SecuritySection } from "@/components/settings/security-section";
import { remainingRecoveryCodeCount } from "@/core/recovery";
import { userHasTotp } from "@/core/totp";
import { getCredentialsForUser } from "@/core/webauthn";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsSecurityPage() {
  const user = await requireAuthUser();
  const passkeys = getCredentialsForUser(db, user.id).map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
  }));

  return (
    <SecuritySection
      passkeys={passkeys}
      totpEnabled={userHasTotp(db, user.id)}
      recoveryCodesRemaining={remainingRecoveryCodeCount(db, user.id)}
    />
  );
}
