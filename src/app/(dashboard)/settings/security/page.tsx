import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SecuritySection } from "@/components/settings/security-section";
import { validateSession } from "@/core/auth";
import { remainingRecoveryCodeCount } from "@/core/recovery";
import { userHasTotp } from "@/core/totp";
import { getCredentialsForUser } from "@/core/webauthn";
import { db } from "@/db";

export default async function SettingsSecurityPage() {
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

  return (
    <SecuritySection
      passkeys={passkeys}
      totpEnabled={userHasTotp(db, user.id)}
      recoveryCodesRemaining={remainingRecoveryCodeCount(db, user.id)}
    />
  );
}
