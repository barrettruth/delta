export type KeySection =
  | "global"
  | "queue"
  | "kanban"
  | "calendar"
  | "navigation"
  | "task_detail";

export type KeyModifier = "ctrl" | "shift" | "meta" | "alt";

export interface KeymapDef {
  id: string;
  key: string;
  triggerKey: string;
  modifiers?: KeyModifier[];
  section: KeySection;
  label: string;
}

export interface HelpRow {
  ids: string[];
  keyDisplay: string;
  label: string;
}

export interface HelpSection {
  section: KeySection;
  rows: HelpRow[];
}
