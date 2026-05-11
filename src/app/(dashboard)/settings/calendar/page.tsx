import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { getActiveGeocodingConfig } from "@/core/geocoding";
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

  return (
    <CalendarSettingsSection
      initialGeoProvider={geoProvider}
      initialNlpProvider={nlpProvider}
    />
  );
}
