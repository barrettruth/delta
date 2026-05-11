import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { getIntegrationConfig } from "@/core/integration-config";
import { db } from "@/db";
import type { NlpProvider } from "@/lib/nlp-models";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsCalendarPage() {
  const user = await requireAuthUser();
  const nlpAnthropic = getIntegrationConfig(db, user.id, "nlp_anthropic");
  const nlpOpenai = getIntegrationConfig(db, user.id, "nlp_openai");

  const nlpProvider: NlpProvider | null =
    nlpAnthropic?.enabled === 1
      ? "anthropic"
      : nlpOpenai?.enabled === 1
        ? "openai"
        : null;

  return <CalendarSettingsSection initialNlpProvider={nlpProvider} />;
}
