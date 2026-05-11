import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { getIntegrationConfig } from "@/core/integration-config";
import { getActiveNlpConfig } from "@/core/nlp-config";
import { db } from "@/db";
import type { NlpProvider } from "@/lib/nlp-models";
import { requireAuthUser } from "@/lib/server-auth";

type GeoProvider = "photon" | "mapbox" | "google_maps";

export default async function SettingsCalendarPage() {
  const user = await requireAuthUser();

  const geoMapbox = getIntegrationConfig(db, user.id, "mapbox");
  const geoGoogle = getIntegrationConfig(db, user.id, "google_maps");
  const geoProvider: GeoProvider = geoGoogle
    ? "google_maps"
    : geoMapbox
      ? "mapbox"
      : "photon";

  const nlpProvider: NlpProvider | null =
    getActiveNlpConfig(db, user.id)?.provider ?? null;

  return (
    <CalendarSettingsSection
      initialGeoProvider={geoProvider}
      initialNlpProvider={nlpProvider}
    />
  );
}
