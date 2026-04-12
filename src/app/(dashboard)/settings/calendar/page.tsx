import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { validateSession } from "@/core/auth";
import { getIntegrationConfig } from "@/core/integration-config";
import { db } from "@/db";
import type { NlpProvider } from "@/lib/nlp-models";

type GeoProvider = "photon" | "mapbox" | "google_maps";

export default async function SettingsCalendarPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const nlpAnthropic = getIntegrationConfig(db, user.id, "nlp_anthropic");
  const nlpOpenai = getIntegrationConfig(db, user.id, "nlp_openai");

  const geoMapbox = getIntegrationConfig(db, user.id, "mapbox");
  const geoGoogle = getIntegrationConfig(db, user.id, "google_maps");
  const geoProvider: GeoProvider = geoGoogle
    ? "google_maps"
    : geoMapbox
      ? "mapbox"
      : "photon";

  const nlpProvider: NlpProvider | null =
    nlpAnthropic?.enabled === 1
      ? "anthropic"
      : nlpOpenai?.enabled === 1
        ? "openai"
        : null;

  return (
    <CalendarSettingsSection
      initialGeoProvider={geoProvider}
      initialNlpProvider={nlpProvider}
    />
  );
}
