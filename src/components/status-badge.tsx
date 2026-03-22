import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/core/types";

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: "pending",
    className:
      "border-status-pending/30 bg-status-pending/10 text-status-pending",
  },
  wip: {
    label: "wip",
    className: "border-status-wip/30 bg-status-wip/10 text-status-wip",
  },
  done: {
    label: "done",
    className: "border-status-done/30 bg-status-done/10 text-status-done",
  },
  blocked: {
    label: "blocked",
    className:
      "border-status-blocked/30 bg-status-blocked/10 text-status-blocked",
  },
  cancelled: {
    label: "cancelled",
    className:
      "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
  },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
}
