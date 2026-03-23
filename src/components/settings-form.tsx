"use client";

import { Settings } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DateFormat,
  UserSettings,
  ViewType,
  WeekStartDay,
} from "@/core/settings";
import { DEFAULT_SETTINGS } from "@/core/settings";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <Label className="text-sm text-muted-foreground shrink-0">{label}</Label>
      <div className="w-48">{children}</div>
    </div>
  );
}

function WeightInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step="0.5"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 text-center tabular-nums"
      />
    </div>
  );
}

export function SettingsForm({
  settings: initial,
  categories,
}: {
  settings: UserSettings;
  categories: string[];
}) {
  const [settings, setSettings] = useState<UserSettings>(initial);
  const [isPending, startTransition] = useTransition();

  function update(partial: Partial<UserSettings>) {
    setSettings((prev) => ({
      ...prev,
      ...partial,
      urgencyWeights: {
        ...prev.urgencyWeights,
        ...(partial.urgencyWeights ?? {}),
      },
    }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSettingsAction(settings);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Settings saved");
      }
    });
  }

  function handleReset() {
    setSettings({ ...DEFAULT_SETTINGS });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs"
          >
            Reset to defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto py-8 px-6 space-y-8">
          <Section title="General">
            <Field label="Default category">
              <Input
                value={settings.defaultCategory}
                onChange={(e) => update({ defaultCategory: e.target.value })}
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Default view">
              <Select
                value={settings.defaultView}
                onValueChange={(v) => update({ defaultView: v as ViewType })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {
                      {
                        queue: "Queue",
                        list: "List",
                        kanban: "Kanban",
                        calendar: "Calendar",
                      }[settings.defaultView]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="queue">Queue</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="kanban">Kanban</SelectItem>
                  <SelectItem value="calendar">Calendar</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-8">
              <Label className="text-sm text-muted-foreground">
                Show completed tasks
              </Label>
              <Checkbox
                checked={settings.showCompletedTasks}
                onCheckedChange={(checked) =>
                  update({ showCompletedTasks: !!checked })
                }
              />
            </div>
          </Section>

          <div className="h-px bg-border/60" />

          <Section title="Date & Time">
            <Field label="Week starts on">
              <Select
                value={String(settings.weekStartDay)}
                onValueChange={(v) =>
                  update({ weekStartDay: Number(v) as WeekStartDay })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {
                      { "1": "Monday", "0": "Sunday" }[
                        String(settings.weekStartDay)
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date format">
              <Select
                value={settings.dateFormat}
                onValueChange={(v) => update({ dateFormat: v as DateFormat })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {
                      { us: "MM/DD/YYYY", iso: "YYYY-MM-DD", eu: "DD/MM/YYYY" }[
                        settings.dateFormat
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">MM/DD/YYYY</SelectItem>
                  <SelectItem value="iso">YYYY-MM-DD</SelectItem>
                  <SelectItem value="eu">DD/MM/YYYY</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <div className="h-px bg-border/60" />

          <Section title="Urgency Weights">
            <WeightInput
              label="Priority"
              value={settings.urgencyWeights.priority}
              onChange={(v) =>
                update({
                  urgencyWeights: { ...settings.urgencyWeights, priority: v },
                })
              }
            />
            <WeightInput
              label="Due date"
              value={settings.urgencyWeights.due}
              onChange={(v) =>
                update({
                  urgencyWeights: { ...settings.urgencyWeights, due: v },
                })
              }
            />
            <WeightInput
              label="Age"
              value={settings.urgencyWeights.age}
              onChange={(v) =>
                update({
                  urgencyWeights: { ...settings.urgencyWeights, age: v },
                })
              }
            />
            <WeightInput
              label="Work in progress"
              value={settings.urgencyWeights.wip}
              onChange={(v) =>
                update({
                  urgencyWeights: { ...settings.urgencyWeights, wip: v },
                })
              }
            />
            <WeightInput
              label="Blocking"
              value={settings.urgencyWeights.blocking}
              onChange={(v) =>
                update({
                  urgencyWeights: { ...settings.urgencyWeights, blocking: v },
                })
              }
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
