import { IntegrationsSection } from "@/components/settings/integrations-section";
import { listReminderDeliveryLog } from "@/core/reminders/deliveries";
import { listReminderEndpoints } from "@/core/reminders/endpoints";
import { listReminderAdapters } from "@/core/reminders/registry";
import { listReminderTransportConfigStatuses } from "@/core/reminders/transport-config";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function SettingsIntegrationsPage() {
  const user = await requireAuthUser();
  const reminderDeliveries = listReminderDeliveryLog(db, user.id);
  const reminderEndpoints = listReminderEndpoints(db, user.id);
  const reminderTransportConfigs = listReminderTransportConfigStatuses(db);
  const reminderAdapters = listReminderAdapters();

  return (
    <IntegrationsSection
      initialReminderDeliveries={reminderDeliveries}
      initialReminderEndpoints={reminderEndpoints}
      initialReminderTransportConfigs={reminderTransportConfigs}
      reminderAdapters={reminderAdapters}
    />
  );
}
