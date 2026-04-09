import { Badge } from "@/components/ui/badge";
import type {
  ReminderDeliveryLogRecord as ReminderDeliveryLogEntry,
  ReminderDeliveryLogRecord,
} from "@/core/reminders/deliveries";
import type {
  ReminderAdapterManifest,
  ReminderDeliveryStatus,
} from "@/core/reminders/types";
import { getReminderChannelLabel } from "@/lib/reminder-endpoint-form";

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date || !time) return value;
  return `${date} ${time.slice(0, 5)} UTC`;
}

function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(" ");
}

function formatReminderRule(
  reminder: ReminderDeliveryLogEntry["reminder"],
): string {
  if (reminder.allDayLocalTime) {
    if (reminder.offsetMinutes === 0) {
      return `${reminder.allDayLocalTime} on ${reminder.anchor} day`;
    }

    return `${reminder.allDayLocalTime}, ${formatDuration(
      Math.abs(reminder.offsetMinutes),
    )} ${reminder.offsetMinutes < 0 ? "before" : "after"} ${reminder.anchor}`;
  }

  if (reminder.offsetMinutes === 0) {
    return `at ${reminder.anchor}`;
  }

  return `${formatDuration(Math.abs(reminder.offsetMinutes))} ${
    reminder.offsetMinutes < 0 ? "before" : "after"
  } ${reminder.anchor}`;
}

function getStatusVariant(status: ReminderDeliveryStatus) {
  switch (status) {
    case "failed":
    case "dead":
      return "destructive";
    case "sent":
      return "outline";
    case "suppressed":
      return "ghost";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: ReminderDeliveryStatus): string {
  switch (status) {
    case "pending":
      return "queued";
    default:
      return status;
  }
}

function getDeliveryOutcome(entry: ReminderDeliveryLogEntry): string | null {
  switch (entry.status) {
    case "sent":
      return entry.sentAt ? `sent ${formatTimestamp(entry.sentAt)}` : "sent";
    case "failed":
      return entry.nextAttemptAt
        ? `next attempt ${formatTimestamp(entry.nextAttemptAt)}`
        : "retry pending";
    case "dead":
      return "no more retries";
    case "suppressed":
      return "suppressed before send";
    case "sending":
      return entry.lastAttemptAt
        ? `attempting since ${formatTimestamp(entry.lastAttemptAt)}`
        : "sending now";
    case "pending":
      return `scheduled ${formatTimestamp(entry.scheduledFor)}`;
  }
}

function ReminderDeliveryEntry({
  entry,
}: {
  entry: ReminderDeliveryLogRecord;
}) {
  const scheduledLabel = formatTimestamp(entry.scheduledFor);
  const outcome = getDeliveryOutcome(entry);

  return (
    <div className="border border-border/60 px-2 py-2 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm truncate">{entry.task.description}</span>
            <Badge variant={getStatusVariant(entry.status)}>
              {getStatusLabel(entry.status)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {getReminderChannelLabel(entry.adapterKey)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatReminderRule(entry.reminder)} · scheduled {scheduledLabel}
            {entry.attempts > 0 ? ` · attempts ${entry.attempts}` : ""}
          </div>
          {outcome && (
            <div className="text-xs text-muted-foreground">{outcome}</div>
          )}
          {entry.providerMessageId && (
            <div className="text-xs text-muted-foreground">
              provider id {entry.providerMessageId}
            </div>
          )}
          {entry.renderedBody && (
            <div className="text-xs text-muted-foreground break-words">
              {entry.renderedBody}
            </div>
          )}
          {entry.error && (
            <div className="text-xs text-destructive break-words">
              {entry.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReminderDeliveryLogSection({
  deliveries,
  adapters: _adapters,
}: {
  deliveries: ReminderDeliveryLogRecord[];
  adapters: ReminderAdapterManifest[];
}) {
  const actionable = deliveries.filter(
    (entry) => entry.status === "failed" || entry.status === "dead",
  );
  const recent = deliveries.slice(0, 10);

  return (
    <div className="space-y-2">
      <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
        issues
      </div>
      {actionable.length === 0 ? (
        <div className="px-2 py-2 text-sm text-muted-foreground">
          no failed reminder sends
        </div>
      ) : (
        actionable.map((entry) => (
          <ReminderDeliveryEntry key={`action-${entry.id}`} entry={entry} />
        ))
      )}

      <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
        recent sends
      </div>
      {recent.length === 0 ? (
        <div className="px-2 py-2 text-sm text-muted-foreground">
          no reminder sends yet
        </div>
      ) : (
        recent.map((entry) => (
          <ReminderDeliveryEntry key={entry.id} entry={entry} />
        ))
      )}
    </div>
  );
}
