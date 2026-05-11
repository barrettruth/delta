"use client";

import { SettingsPage, SettingsSection } from "./settings-primitives";

export function IntegrationsSection() {
  return (
    <SettingsPage
      title="integrations"
      description="Manage external services that connect to delta."
    >
      <SettingsSection
        title="connected services"
        description="Calendar provider setup lives in the calendar settings page."
        dividers={false}
      />
    </SettingsPage>
  );
}
