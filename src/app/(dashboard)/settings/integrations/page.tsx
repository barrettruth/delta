import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { validateSession } from "@/core/auth";
import { getIntegrationConfig } from "@/core/integration-config";
import { listReminderDeliveryLog } from "@/core/reminders/deliveries";
import { listReminderEndpoints } from "@/core/reminders/endpoints";
import { listReminderAdapters } from "@/core/reminders/registry";
import { listReminderTransportConfigStatuses } from "@/core/reminders/transport-config";
import { db } from "@/db";

export default async function SettingsIntegrationsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const gcal = getIntegrationConfig(db, user.id, "google_calendar");
  const nlpAnthropic = getIntegrationConfig(db, user.id, "nlp_anthropic");
  const nlpOpenai = getIntegrationConfig(db, user.id, "nlp_openai");

  const geoMapbox = getIntegrationConfig(db, user.id, "mapbox");
  const geoGoogle = getIntegrationConfig(db, user.id, "google_maps");
  const geoProvider = geoGoogle
    ? "google_maps"
    : geoMapbox
      ? "mapbox"
      : "photon";

  const nlpProvider =
    nlpAnthropic?.enabled === 1
      ? ("anthropic" as const)
      : nlpOpenai?.enabled === 1
        ? ("openai" as const)
        : null;

  const conflictResolution =
    (gcal?.metadata?.conflictResolution as string) ?? "google_wins";
  const syncInterval = (gcal?.metadata?.syncInterval as number) ?? 5;
  const reminderDeliveries = listReminderDeliveryLog(db, user.id);
  const reminderEndpoints = listReminderEndpoints(db, user.id);
  const reminderTransportConfigs = listReminderTransportConfigStatuses(db);
  const reminderAdapters = listReminderAdapters();

  return (
    <IntegrationsSection
      gcalConnected={!!gcal}
      initialGeoProvider={geoProvider}
      initialConflictResolution={
        conflictResolution as "lww" | "google_wins" | "delta_wins"
      }
      initialSyncInterval={syncInterval as 5 | 15 | 30}
      initialNlpProvider={nlpProvider}
      initialReminderDeliveries={reminderDeliveries}
      initialReminderEndpoints={reminderEndpoints}
      initialReminderTransportConfigs={reminderTransportConfigs}
      reminderAdapters={reminderAdapters}
    />
  );
}
