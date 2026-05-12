import type { HelpRow } from "@/lib/keymap/types";

export function helpRow(
  ids: string | string[],
  keyDisplay: string,
  label: string,
): HelpRow {
  return { ids: Array.isArray(ids) ? ids : [ids], keyDisplay, label };
}
