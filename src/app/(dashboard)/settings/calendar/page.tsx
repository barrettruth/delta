import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { getFeedToken } from "@/core/calendar-feed";
import { getActiveGeocodingConfig } from "@/core/geocoding";
import { googleIntegrationSummary } from "@/core/google/oauth";
import { getActiveNlpConfig } from "@/core/nlp-config";
import type {
  GeocodingProvider,
  NlpProviderId,
} from "@/core/provider-registry";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsCalendarPage() {
  const user = await requireAuthUser();

  const geoProvider: GeocodingProvider = getActiveGeocodingConfig(
    db,
    user.id,
  ).provider;

  const nlpProvider: NlpProviderId | null =
    getActiveNlpConfig(db, user.id)?.provider ?? null;
  const google = googleIntegrationSummary(db, user.id);
  const feedToken = getFeedToken(db, user.id);

  return (
    <CalendarSettingsSection
      initialGeoProvider={geoProvider}
      initialFeedToken={feedToken}
      initialNlpProvider={nlpProvider}
      initialGoogle={google}
    />
  );
}
