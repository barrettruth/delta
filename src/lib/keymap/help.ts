import { CALENDAR_HELP_ROWS } from "@/lib/keymap/calendar";
import { GLOBAL_HELP_ROWS } from "@/lib/keymap/global";
import { KANBAN_HELP_ROWS } from "@/lib/keymap/kanban";
import { NAVIGATION_HELP_ROWS } from "@/lib/keymap/navigation";
import { QUEUE_HELP_ROWS } from "@/lib/keymap/queue";
import { TASK_DETAIL_HELP_ROWS } from "@/lib/keymap/task-detail";
import type { HelpSection } from "@/lib/keymap/types";

export const HELP_SECTIONS: HelpSection[] = [
  {
    section: "global",
    rows: GLOBAL_HELP_ROWS,
  },
  {
    section: "queue",
    rows: QUEUE_HELP_ROWS,
  },
  {
    section: "kanban",
    rows: KANBAN_HELP_ROWS,
  },
  {
    section: "calendar",
    rows: CALENDAR_HELP_ROWS,
  },
  {
    section: "navigation",
    rows: NAVIGATION_HELP_ROWS,
  },
  {
    section: "task_detail",
    rows: TASK_DETAIL_HELP_ROWS,
  },
];
