import type {
  GoogleCalendarPullSummary,
  GoogleTasksPullSummary,
} from "@/core/google/types";

export const DASHBOARD_TASKS_CHANGED_EVENT = "delta:dashboard-tasks-changed";

type SyncSummary = Pick<
  GoogleCalendarPullSummary | GoogleTasksPullSummary,
  "created" | "updated" | "cancelled"
>;

export function syncSummaryChangedTasks(summary: SyncSummary): boolean {
  return summary.created > 0 || summary.updated > 0 || summary.cancelled > 0;
}

export function notifyDashboardTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DASHBOARD_TASKS_CHANGED_EVENT));
}

export function onDashboardTasksChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DASHBOARD_TASKS_CHANGED_EVENT, handler);
  return () =>
    window.removeEventListener(DASHBOARD_TASKS_CHANGED_EVENT, handler);
}
