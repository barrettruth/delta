import type { KeySection } from "@/lib/keymap/types";

export const SECTION_LABELS: Record<KeySection, string> = {
  global: "Global",
  queue: "Queue / List",
  kanban: "Kanban",
  calendar: "Calendar",
  navigation: "Navigation",
  task_detail: "Task Detail",
};

export const SECTION_ORDER: KeySection[] = [
  "global",
  "queue",
  "kanban",
  "calendar",
  "navigation",
  "task_detail",
];

const VIEW_SECTIONS: Record<string, KeySection[]> = {
  "/": ["global", "queue", "navigation", "task_detail"],
  "/queue": ["global", "queue", "navigation", "task_detail"],
  "/kanban": ["global", "kanban", "navigation", "task_detail"],
  "/calendar": ["global", "calendar", "navigation", "task_detail"],
};

export function sectionsForPath(pathname: string): KeySection[] {
  return VIEW_SECTIONS[pathname] ?? ["global"];
}
