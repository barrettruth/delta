import { helpRow } from "@/lib/keymap/help-row";
import type { HelpRow, KeymapDef } from "@/lib/keymap/types";

export const NAVIGATION_KEYMAPS: KeymapDef[] = [
  {
    id: "nav.jump_back",
    key: "o",
    triggerKey: "o",
    modifiers: ["ctrl"],
    section: "navigation",
    label: "Jump back",
  },
  {
    id: "nav.jump_forward",
    key: "i",
    triggerKey: "i",
    modifiers: ["ctrl"],
    section: "navigation",
    label: "Jump forward",
  },
  {
    id: "nav.alternate",
    key: "6",
    triggerKey: "6",
    modifiers: ["ctrl"],
    section: "navigation",
    label: "Alternate buffer",
  },
];

export const NAVIGATION_HELP_ROWS: HelpRow[] = [
  helpRow("nav.jump_back", "<C-o>", "Jump back"),
  helpRow("nav.jump_forward", "<C-i>", "Jump forward"),
  helpRow("nav.alternate", "<C-6>", "Alternate buffer"),
];
