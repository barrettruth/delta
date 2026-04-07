import { Badge } from "@/components/ui/badge";
import type {
  ReminderDeliveryLogRecord as ReminderDeliveryLogEntry,
  ReminderDeliveryLogRecord,
} from "@/core/reminders/deliveries";
import type {
  ReminderAdapterKey,
  ReminderAdapterManifest,
  ReminderDeliveryStatus,
} from "@/core/reminders/types";

type Playbook = {
  adapterKey: ReminderAdapterKey;
  steps: string[];
  note?: string;
};

const OPERATOR_PLAYBOOKS: Playbook[] = [
  {
    adapterKey: "sms.twilio",
    steps: [
      "Save the account SID, auth token, and from number in transport config.",
      "Add an endpoint with the recipient phone number in E.164 format.",
      "Use the endpoint test action, then confirm the message arrives and the history shows a sent delivery.",
      "Keep the public proof-of-consent page aligned with the current SMS opt-in flow.",
    ],
  },
  {
    adapterKey: "telegram.bot_api",
    steps: [
      "Save the bot token in transport config.",
      "Add an endpoint with the target chat ID.",
      "Use the endpoint test action after the bot has already joined or started the chat.",
      "If deliveries fail, re-check bot access and the stored chat ID.",
    ],
  },
  {
    adapterKey: "slack.webhook",
    steps: [
      "Create an incoming webhook for the destination channel.",
      "Store the webhook URL as the endpoint target.",
      "Use the endpoint test action and confirm the message lands in the channel.",
      "Dead deliveries usually mean the webhook was revoked or lost channel access.",
    ],
  },
  {
    adapterKey: "discord.webhook",
    steps: [
      "Create a Discord webhook for the destination channel.",
      "Store the webhook URL as the endpoint target.",
      "Use the endpoint test action and confirm the channel receives the message.",
      "If deliveries fail, re-check channel permissions and whether the webhook still exists.",
    ],
  },
  {
    adapterKey: "signal.signal_cli",
    steps: [
      "Signal remains beta and depends on a signal-cli account that delta can access on the host.",
      "Save the sender account and signal-cli config path in transport config before creating endpoints.",
      "Add the recipient identifier as the endpoint target and use the endpoint test action for a direct send.",
      "After any signal-cli upgrade or account change, run a manual end-to-end verification on the deployed host.",
    ],
    note: "Signal still requires manual live verification and dedicated service-line operations, even though send and test-send are wired into delta.",
  },
];

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
  adapterName,
}: {
  entry: ReminderDeliveryLogRecord;
  adapterName: string;
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
            {adapterName} · {entry.endpoint.label}
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
  adapters,
}: {
  deliveries: ReminderDeliveryLogRecord[];
  adapters: ReminderAdapterManifest[];
}) {
  const actionable = deliveries.filter(
    (entry) => entry.status === "failed" || entry.status === "dead",
  );
  const adapterByKey = new Map(
    adapters.map((adapter) => [adapter.key, adapter]),
  );

  return (
    <div className="space-y-2">
      <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
        attention needed
      </div>
      {actionable.length === 0 ? (
        <div className="px-2 py-2 text-sm text-muted-foreground">
          no failed or dead deliveries
        </div>
      ) : (
        actionable.map((entry) => (
          <ReminderDeliveryEntry
            key={`action-${entry.id}`}
            entry={entry}
            adapterName={
              adapterByKey.get(entry.adapterKey)?.displayName ??
              entry.adapterKey
            }
          />
        ))
      )}

      <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
        delivery history
      </div>
      {deliveries.length === 0 ? (
        <div className="px-2 py-2 text-sm text-muted-foreground">
          no reminder deliveries yet
        </div>
      ) : (
        deliveries.map((entry) => (
          <ReminderDeliveryEntry
            key={entry.id}
            entry={entry}
            adapterName={
              adapterByKey.get(entry.adapterKey)?.displayName ??
              entry.adapterKey
            }
          />
        ))
      )}

      <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
        operator playbooks
      </div>
      <div className="space-y-2">
        {OPERATOR_PLAYBOOKS.map((playbook) => {
          const adapter = adapterByKey.get(playbook.adapterKey);
          const title = adapter?.displayName ?? playbook.adapterKey;

          return (
            <div
              key={playbook.adapterKey}
              className="border border-border/60 px-2 py-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{title}</span>
                {adapter?.capabilities.beta && (
                  <Badge variant="outline">beta</Badge>
                )}
              </div>
              <ul className="space-y-1 pl-4 text-xs text-muted-foreground list-disc">
                {playbook.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              {playbook.note && (
                <div className="text-xs text-muted-foreground">
                  {playbook.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
