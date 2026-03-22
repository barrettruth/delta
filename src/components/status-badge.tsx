import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/core/types";

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: "pending",
    className:
      "bg-status-pending/15 text-status-pending border-status-pending/30",
  },
  wip: {
    label: "wip",
    className: "bg-status-wip/15 text-status-wip border-status-wip/30",
  },
  done: {
    label: "done",
    className: "bg-status-done/15 text-status-done border-status-done/30",
  },
  blocked: {
    label: "blocked",
    className:
      "bg-status-blocked/15 text-status-blocked border-status-blocked/30",
  },
  cancelled: {
    label: "cancelled",
    className:
      "bg-status-cancelled/15 text-status-cancelled border-status-cancelled/30",
  },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
