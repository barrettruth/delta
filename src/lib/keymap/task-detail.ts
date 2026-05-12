import { helpRow } from "@/lib/keymap/help-row";
import type { HelpRow, KeymapDef } from "@/lib/keymap/types";

export const TASK_DETAIL_KEYMAPS: KeymapDef[] = [
  {
    id: "task_detail.save",
    key: "s",
    triggerKey: "s",
    modifiers: ["ctrl"],
    section: "task_detail",
    label: "Save",
  },
  {
    id: "task_detail.close",
    key: "Escape",
    triggerKey: "Escape",
    section: "task_detail",
    label: "Close",
  },
  {
    id: "task_detail.create",
    key: "Enter",
    triggerKey: "Enter",
    section: "task_detail",
    label: "Create (in new task mode)",
  },
];

export const TASK_DETAIL_HELP_ROWS: HelpRow[] = [
  helpRow("task_detail.save", "<C-s>", "Save"),
  helpRow("task_detail.close", "<Esc>", "Close"),
  helpRow("task_detail.create", "<CR>", "Create (in new task mode)"),
];
