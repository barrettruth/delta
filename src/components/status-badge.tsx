import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/core/types";

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: "pending",
    className:
      "border-status-pending/40 bg-status-pending/15 text-status-pending",
  },
  wip: {
    label: "wip",
    className: "border-status-wip/40 bg-status-wip/15 text-status-wip",
  },
  done: {
    label: "done",
    className: "border-status-done/40 bg-status-done/15 text-status-done",
  },
  blocked: {
    label: "blocked",
    className:
      "border-status-blocked/40 bg-status-blocked/15 text-status-blocked",
  },
  cancelled: {
    label: "cancelled",
    className:
      "border-status-cancelled/40 bg-status-cancelled/15 text-status-cancelled",
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
