import type { KeyboardEventLike } from "@/lib/keyboard";
import { CALENDAR_KEYMAPS } from "@/lib/keymap/calendar";
import { GLOBAL_KEYMAPS } from "@/lib/keymap/global";
import { HELP_SECTIONS } from "@/lib/keymap/help";
import { KANBAN_KEYMAPS } from "@/lib/keymap/kanban";
import { NAVIGATION_KEYMAPS } from "@/lib/keymap/navigation";
import { QUEUE_KEYMAPS } from "@/lib/keymap/queue";
import {
  SECTION_LABELS,
  SECTION_ORDER,
  sectionsForPath,
} from "@/lib/keymap/sections";
import { TASK_DETAIL_KEYMAPS } from "@/lib/keymap/task-detail";
import type { KeymapDef, KeySection } from "@/lib/keymap/types";

export type {
  HelpRow,
  HelpSection,
  KeyModifier,
  KeymapDef,
  KeySection,
} from "@/lib/keymap/types";
export { HELP_SECTIONS, SECTION_LABELS, SECTION_ORDER, sectionsForPath };

export const DEFAULT_KEYMAPS: KeymapDef[] = [
  ...GLOBAL_KEYMAPS,
  ...QUEUE_KEYMAPS,
  ...KANBAN_KEYMAPS,
  ...CALENDAR_KEYMAPS,
  ...NAVIGATION_KEYMAPS,
  ...TASK_DETAIL_KEYMAPS,
];

const keymapById = new Map<string, KeymapDef>();
for (const def of DEFAULT_KEYMAPS) {
  keymapById.set(def.id, def);
}

export function getKeymap(id: string): KeymapDef {
  const def = keymapById.get(id);
  if (!def) throw new Error(`Unknown keymap id: ${id}`);
  return def;
}

export function getKeymapsBySection(section: KeySection): KeymapDef[] {
  return DEFAULT_KEYMAPS.filter((def) => def.section === section);
}

export function matchesEvent(id: string, e: KeyboardEventLike): boolean {
  const def = getKeymap(id);
  if (e.key !== def.triggerKey) return false;
  const wantCtrlOrMeta =
    (def.modifiers?.includes("ctrl") ?? false) ||
    (def.modifiers?.includes("meta") ?? false);
  const wantShift = def.modifiers?.includes("shift") ?? false;
  const wantAlt = def.modifiers?.includes("alt") ?? false;
  return (
    (e.ctrlKey || e.metaKey) === wantCtrlOrMeta &&
    e.shiftKey === wantShift &&
    e.altKey === wantAlt
  );
}

export function formatKey(def: KeymapDef): string {
  if (def.modifiers?.length) {
    const mods = def.modifiers.map((m) => {
      if (m === "ctrl") return "C";
      if (m === "shift") return "S";
      if (m === "meta") return "M";
      if (m === "alt") return "A";
      return m;
    });
    return `<${mods.join("-")}-${def.triggerKey}>`;
  }
  if (def.triggerKey === "Escape") return "<Esc>";
  if (def.triggerKey === "Enter") return "<CR>";
  return def.triggerKey;
}
