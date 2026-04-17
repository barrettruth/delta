"use client";

import { ReminderEndpointsSection } from "@/components/settings/reminder-endpoints-section";
import type { ReminderDeliveryLogRecord } from "@/core/reminders/deliveries";
import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type { ReminderAdapterManifest } from "@/core/reminders/types";
import type { ReminderTransportConfigStatus } from "@/lib/reminder-transport-form";
import { SettingsPage } from "./settings-primitives";

export function IntegrationsSection({
  initialReminderDeliveries = [],
  initialReminderEndpoints = [],
  initialReminderTransportConfigs = [],
  reminderAdapters = [],
}: {
  initialReminderDeliveries?: ReminderDeliveryLogRecord[];
  initialReminderEndpoints?: ReminderEndpointRecord[];
  initialReminderTransportConfigs?: ReminderTransportConfigStatus[];
  reminderAdapters?: ReminderAdapterManifest[];
}) {
  return (
    <SettingsPage
      title="integrations"
      description="Set up where delta can send reminders. Most people only need one or two destinations here."
    >
      <ReminderEndpointsSection
        initialDeliveries={initialReminderDeliveries}
        initialEndpoints={initialReminderEndpoints}
        initialTransportConfigs={initialReminderTransportConfigs}
        adapters={reminderAdapters}
      />
    </SettingsPage>
  );
}
