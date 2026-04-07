"use client";

import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type { ReminderAnchor } from "@/core/reminders/types";
import {
  buildReminderOffsetMinutes,
  formatTaskPanelReminderSummary,
  getReminderOffsetDirection,
  getReminderOffsetMagnitude,
  type ReminderOffsetDirection,
  type TaskPanelReminderDraft,
} from "@/lib/task-panel-reminders";

interface TaskPanelRemindersProps {
  allDay: boolean;
  endpoints: ReminderEndpointRecord[];
  reminders: TaskPanelReminderDraft[];
  loading: boolean;
  error: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onAddReminder: () => void;
  onChangeReminder: (
    clientId: string,
    patch: Partial<Omit<TaskPanelReminderDraft, "clientId">>,
  ) => void;
  onRemoveReminder: (clientId: string) => void;
}

export const TaskPanelReminders = memo(function TaskPanelReminders({
  allDay,
  endpoints,
  reminders,
  loading,
  error,
  expanded,
  onExpandedChange,
  onAddReminder,
  onChangeReminder,
  onRemoveReminder,
}: TaskPanelRemindersProps) {
  const endpointMap = useMemo(
    () => new Map(endpoints.map((endpoint) => [endpoint.id, endpoint])),
    [endpoints],
  );

  const toggleLabel = expanded ? "done" : reminders.length > 0 ? "edit" : "add";

  return (
    <div className="px-4 py-3 border-b border-border/40">
      <div className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-2 items-start">
        <span className="text-xs text-muted-foreground/60">reminders</span>
        <div className="space-y-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1 min-w-0">
              {loading ? (
                <span className="text-xs text-muted-foreground">
                  loading...
                </span>
              ) : reminders.length === 0 ? (
                <span className="text-xs text-muted-foreground">none</span>
              ) : (
                reminders.map((reminder) => (
                  <Badge
                    key={reminder.clientId}
                    variant={reminder.enabled === 1 ? "outline" : "ghost"}
                    className="max-w-full"
                  >
                    <span className="truncate">
                      {formatTaskPanelReminderSummary(reminder, endpointMap, {
                        allDay,
                      })}
                      {reminder.enabled === 0 ? " · off" : ""}
                    </span>
                  </Badge>
                ))
              )}
            </div>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => onExpandedChange(!expanded)}
            >
              {toggleLabel}
            </Button>
          </div>

          {expanded && (
            <div className="space-y-3">
              {error && <div className="text-xs text-destructive">{error}</div>}

              {!loading && endpoints.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  no reminder endpoints configured yet
                </div>
              ) : (
                <>
                  {reminders.map((reminder, index) => (
                    <ReminderEditorRow
                      key={reminder.clientId}
                      allDay={allDay}
                      endpoints={endpoints}
                      reminder={reminder}
                      index={index}
                      onChangeReminder={onChangeReminder}
                      onRemoveReminder={onRemoveReminder}
                    />
                  ))}

                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={onAddReminder}
                    disabled={loading || endpoints.length === 0}
                  >
                    add reminder
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const ReminderEditorRow = memo(function ReminderEditorRow({
  allDay,
  endpoints,
  reminder,
  index,
  onChangeReminder,
  onRemoveReminder,
}: {
  allDay: boolean;
  endpoints: ReminderEndpointRecord[];
  reminder: TaskPanelReminderDraft;
  index: number;
  onChangeReminder: (
    clientId: string,
    patch: Partial<Omit<TaskPanelReminderDraft, "clientId">>,
  ) => void;
  onRemoveReminder: (clientId: string) => void;
}) {
  const direction = getReminderOffsetDirection(reminder.offsetMinutes);
  const magnitude = getReminderOffsetMagnitude(reminder.offsetMinutes);

  return (
    <div className="border border-border/60 px-2 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground/60">
          reminder {index + 1}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => onRemoveReminder(reminder.clientId)}
        >
          remove
        </Button>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground/60">endpoint</span>
          <Select
            value={
              reminder.endpointId !== null ? String(reminder.endpointId) : ""
            }
            onValueChange={(value) => {
              if (!value) return;
              onChangeReminder(reminder.clientId, {
                endpointId: Number(value),
              });
            }}
          >
            <SelectTrigger size="sm" className="h-7 text-xs w-full">
              <SelectValue placeholder="select endpoint" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {endpoints.map((endpoint) => (
                <SelectItem key={endpoint.id} value={String(endpoint.id)}>
                  {endpoint.enabled === 1
                    ? endpoint.label
                    : `${endpoint.label} (off)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground/60">timing</span>
          <div className="flex flex-wrap items-center gap-2">
            <AnchorSelect
              value={reminder.anchor}
              onValueChange={(value) =>
                onChangeReminder(reminder.clientId, { anchor: value })
              }
            />
            <DirectionSelect
              value={direction}
              onValueChange={(value) =>
                onChangeReminder(reminder.clientId, {
                  offsetMinutes: buildReminderOffsetMinutes(value, magnitude),
                })
              }
            />
            <Input
              type="number"
              min="0"
              step="1"
              value={String(magnitude)}
              disabled={direction === "at"}
              onChange={(e) =>
                onChangeReminder(reminder.clientId, {
                  offsetMinutes: buildReminderOffsetMinutes(
                    direction,
                    Number(e.target.value),
                  ),
                })
              }
              className="h-7 text-xs w-20"
            />
            <span className="text-xs text-muted-foreground/60">min</span>
          </div>
        </div>

        {allDay && (
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground/60">
              local time
            </span>
            <Input
              type="time"
              value={reminder.allDayLocalTime ?? ""}
              onChange={(e) =>
                onChangeReminder(reminder.clientId, {
                  allDayLocalTime: e.target.value || null,
                })
              }
              className="h-7 text-xs w-28"
            />
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={reminder.enabled === 1}
            onCheckedChange={(checked) =>
              onChangeReminder(reminder.clientId, {
                enabled: checked ? 1 : 0,
              })
            }
          />
          <span>enabled</span>
        </div>
      </div>
    </div>
  );
});

const AnchorSelect = memo(function AnchorSelect({
  value,
  onValueChange,
}: {
  value: ReminderAnchor;
  onValueChange: (value: ReminderAnchor) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onValueChange(next as ReminderAnchor);
      }}
    >
      <SelectTrigger size="sm" className="h-7 text-xs w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value="due">due</SelectItem>
        <SelectItem value="start">start</SelectItem>
      </SelectContent>
    </Select>
  );
});

const DirectionSelect = memo(function DirectionSelect({
  value,
  onValueChange,
}: {
  value: ReminderOffsetDirection;
  onValueChange: (value: ReminderOffsetDirection) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onValueChange(next as ReminderOffsetDirection);
      }}
    >
      <SelectTrigger size="sm" className="h-7 text-xs w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value="before">before</SelectItem>
        <SelectItem value="after">after</SelectItem>
        <SelectItem value="at">at</SelectItem>
      </SelectContent>
    </Select>
  );
});
