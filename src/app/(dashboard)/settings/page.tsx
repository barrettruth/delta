import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/core/auth";
import { getIntegrationConfig } from "@/core/integration-config";
import { getEnabledProviders, getLinkedAccounts } from "@/core/oauth";
import { remainingRecoveryCodeCount } from "@/core/recovery";
import { userHasTotp } from "@/core/totp";
import { getCredentialsForUser } from "@/core/webauthn";
import { db } from "@/db";
import { NLP_MODELS } from "@/lib/nlp-models";
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
  const connectedAccounts = getLinkedAccounts(db, user.id);
  const enabledProviders = getEnabledProviders(db);

  const nlpAnthropic = getIntegrationConfig(db, user.id, "nlp_anthropic");
  const nlpOpenai = getIntegrationConfig(db, user.id, "nlp_openai");

  const nlpConfig = {
    activeProvider:
      nlpAnthropic?.enabled === 1
        ? ("anthropic" as const)
        : nlpOpenai?.enabled === 1
          ? ("openai" as const)
          : null,
    anthropicModel:
      (nlpAnthropic?.metadata?.model as string) ?? NLP_MODELS.anthropic[0].id,
    openaiModel:
      (nlpOpenai?.metadata?.model as string) ?? NLP_MODELS.openai[0].id,
    anthropicConfigured: !!nlpAnthropic,
    openaiConfigured: !!nlpOpenai,
  };

  return (
    <SettingsView
      username={user.username}
      passkeys={passkeys}
      totpEnabled={totpEnabled}
      recoveryCodesRemaining={recoveryCodesRemaining}
      connectedAccounts={connectedAccounts}
      enabledProviders={enabledProviders}
      nlpConfig={nlpConfig}
    />
  );
}
