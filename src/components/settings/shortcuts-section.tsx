"use client";

import { HELP_SECTIONS, SECTION_LABELS } from "@/lib/keymap-defs";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

export function ShortcutsSection() {
  return (
    <SettingsPage title="shortcuts">
      <div className="grid gap-5 lg:grid-cols-2">
        {HELP_SECTIONS.map((section) => (
          <SettingsSection
            key={section.section}
            title={SECTION_LABELS[section.section].toLowerCase()}
          >
            {section.rows.map((row) => (
              <SettingsRow
                key={`${section.section}-${row.keyDisplay}-${row.label}`}
                label={row.label}
                value={row.keyDisplay}
              />
            ))}
          </SettingsSection>
        ))}
      </div>
    </SettingsPage>
  );
}
