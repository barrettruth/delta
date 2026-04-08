import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { validateSession } from "@/core/auth";
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
