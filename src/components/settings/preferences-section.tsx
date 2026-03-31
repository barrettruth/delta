"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import type { UserSettings, ViewType } from "@/core/settings";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

const VIEWS: { id: ViewType; label: string }[] = [
  { id: "queue", label: "queue" },
  { id: "kanban", label: "kanban" },
  { id: "calendar", label: "calendar" },
];

const WEIGHT_KEYS = [
  { id: "due" as const, label: "due date" },
  { id: "age" as const, label: "age" },
  { id: "wip" as const, label: "in-progress" },
  { id: "blocking" as const, label: "blocking" },
];

export function PreferencesSection({
  settings: initial,
}: {
  settings: UserSettings;
}) {
  const statusBar = useStatusBar();
  const [settings, setSettings] = useState(initial);
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(initial.defaultCategory);

  async function save(partial: Partial<UserSettings>) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    if (!res.ok) {
      statusBar.error("failed to save");
      return;
    }
    const updated = await res.json();
    setSettings((prev) => ({ ...prev, ...updated }));
    statusBar.message("saved");
  }

  function handleViewChange(view: ViewType) {
    setSettings((prev) => ({ ...prev, defaultView: view }));
    save({ defaultView: view });
  }

  function handleWeightChange(
    key: keyof UserSettings["urgencyWeights"],
    value: number,
  ) {
    const clamped = Math.max(0, Math.min(100, value));
    setSettings((prev) => ({
      ...prev,
      urgencyWeights: { ...prev.urgencyWeights, [key]: clamped },
    }));
  }

  function handleWeightBlur() {
    save({ urgencyWeights: settings.urgencyWeights });
  }

  function handleCategorySave() {
    const trimmed = categoryInput.trim();
    if (trimmed && trimmed !== settings.defaultCategory) {
      setSettings((prev) => ({ ...prev, defaultCategory: trimmed }));
      save({ defaultCategory: trimmed });
    }
    setEditingCategory(false);
  }

  return (
    <SettingsPage>
      <SettingsSection title="default view">
        {VIEWS.map((v) => (
          <SettingsRow
            key={v.id}
            label={v.label}
            value={settings.defaultView === v.id ? "active" : ""}
            action
            muted={settings.defaultView !== v.id}
            onClick={() => handleViewChange(v.id)}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="default category">
        {editingCategory ? (
          <div className="px-2">
            <Input
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              autoFocus
              className="h-7 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCategorySave();
                if (e.key === "Escape") {
                  setCategoryInput(settings.defaultCategory);
                  setEditingCategory(false);
                }
              }}
              onBlur={handleCategorySave}
            />
          </div>
        ) : (
          <SettingsRow
            label={settings.defaultCategory}
            action
            onClick={() => setEditingCategory(true)}
          />
        )}
      </SettingsSection>

      <SettingsSection title="show completed tasks">
        <SettingsRow
          label={settings.showCompletedTasks ? "enabled" : "disabled"}
          action
          onClick={() => {
            const next = !settings.showCompletedTasks;
            setSettings((prev) => ({ ...prev, showCompletedTasks: next }));
            save({ showCompletedTasks: next });
          }}
        />
      </SettingsSection>

      <SettingsSection title="urgency weights">
        {WEIGHT_KEYS.map((w) => (
          <div key={w.id} className="flex items-center gap-2 px-2 py-1">
            <span className="text-sm text-muted-foreground w-24 shrink-0">
              {w.label}
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              value={settings.urgencyWeights[w.id]}
              onChange={(e) =>
                handleWeightChange(
                  w.id,
                  Number.parseInt(e.target.value, 10) || 0,
                )
              }
              onBlur={handleWeightBlur}
              className="h-7 text-sm w-20"
            />
          </div>
        ))}
      </SettingsSection>
    </SettingsPage>
  );
}
