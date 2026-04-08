export type KeySection =
  | "global"
  | "queue"
  | "kanban"
  | "calendar"
  | "navigation"
  | "task_detail";

export interface KeymapDef {
  id: string;
  key: string;
  triggerKey: string;
  modifiers?: ("ctrl" | "shift" | "meta" | "alt")[];
  configurable?: boolean;
  section: KeySection;
  label: string;
}

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
  "/queue": ["global", "queue", "navigation", "task_detail"],
  "/kanban": ["global", "kanban", "navigation", "task_detail"],
  "/calendar": ["global", "calendar", "navigation", "task_detail"],
};

export function sectionsForPath(pathname: string): KeySection[] {
  return VIEW_SECTIONS[pathname] ?? ["global"];
}

export const DEFAULT_KEYMAPS: KeymapDef[] = [
  {
    id: "global.queue",
    key: "Q",
    triggerKey: "Q",
    section: "global",
    label: "Queue view",
  },
  {
    id: "global.kanban",
    key: "K",
    triggerKey: "K",
    section: "global",
    label: "Kanban view",
  },
  {
    id: "global.calendar",
    key: "C",
    triggerKey: "C",
    section: "global",
    label: "Calendar view",
  },
  {
    id: "global.settings",
    key: "S",
    triggerKey: "S",
    section: "global",
    label: "Settings",
  },
  {
    id: "global.calendar_week",
    key: "w",
    triggerKey: "w",
    section: "global",
    label: "Calendar week view",
  },
  {
    id: "global.calendar_month",
    key: "m",
    triggerKey: "m",
    section: "global",
    label: "Calendar month view",
  },
  {
    id: "global.toggle_sidebar",
    key: "-",
    triggerKey: "-",
    section: "global",
    label: "Toggle sidebar",
  },
  {
    id: "global.logout",
    key: "q",
    triggerKey: "q",
    section: "global",
    label: "Logout",
  },
  {
    id: "global.undo",
    key: "u",
    triggerKey: "u",
    section: "global",
    label: "Undo",
  },
  {
    id: "global.category_jump",
    key: "g1-9",
    triggerKey: "g",
    configurable: false,
    section: "global",
    label: "Jump to category",
  },
  {
    id: "global.create_task",
    key: "gc",
    triggerKey: "g",
    configurable: false,
    section: "global",
    label: "Create task",
  },
  {
    id: "global.toggle_done",
    key: "g.",
    triggerKey: "g",
    configurable: false,
    section: "global",
    label: "Toggle done tasks",
  },
  {
    id: "global.help",
    key: "g?",
    triggerKey: "g",
    configurable: false,
    section: "global",
    label: "This help",
  },
  {
    id: "queue.move_down",
    key: "j",
    triggerKey: "j",
    section: "queue",
    label: "Move down",
  },
  {
    id: "queue.move_up",
    key: "k",
    triggerKey: "k",
    section: "queue",
    label: "Move up",
  },
  {
    id: "queue.jump_top",
    key: "gg",
    triggerKey: "g",
    section: "queue",
    label: "Jump to top",
  },
  {
    id: "queue.jump_bottom",
    key: "G",
    triggerKey: "G",
    section: "queue",
    label: "Jump to bottom",
  },
  {
    id: "queue.half_page_down",
    key: "d",
    triggerKey: "d",
    modifiers: ["ctrl"],
    section: "queue",
    label: "Half page down",
  },
  {
    id: "queue.half_page_up",
    key: "u",
    triggerKey: "u",
    modifiers: ["ctrl"],
    section: "queue",
    label: "Half page up",
  },
  {
    id: "queue.search",
    key: "/",
    triggerKey: "/",
    section: "queue",
    label: "Search filter",
  },
  {
    id: "queue.edit",
    key: "e",
    triggerKey: "e",
    section: "queue",
    label: "Edit / create task",
  },
  {
    id: "queue.complete",
    key: "xx / xj / xk",
    triggerKey: "x",
    configurable: false,
    section: "queue",
    label: "Complete task(s)",
  },
  {
    id: "queue.delete",
    key: "dd / dj / dk",
    triggerKey: "d",
    configurable: false,
    section: "queue",
    label: "Delete task(s)",
  },
  {
    id: "queue.set_pending",
    key: "pp / pj / pk",
    triggerKey: "p",
    configurable: false,
    section: "queue",
    label: "Set pending",
  },
  {
    id: "queue.set_wip",
    key: "ww / wj / wk",
    triggerKey: "w",
    configurable: false,
    section: "queue",
    label: "Set wip",
  },
  {
    id: "queue.set_blocked",
    key: "bb / bj / bk",
    triggerKey: "b",
    configurable: false,
    section: "queue",
    label: "Set blocked",
  },
  {
    id: "queue.toggle_select",
    key: "v",
    triggerKey: "v",
    section: "queue",
    label: "Toggle select",
  },
  {
    id: "queue.visual_mode",
    key: "V",
    triggerKey: "V",
    section: "queue",
    label: "Visual select mode",
  },
  {
    id: "queue.escape",
    key: "Escape",
    triggerKey: "Escape",
    section: "queue",
    label: "Clear / close",
  },

  {
    id: "kanban.col_left",
    key: "h",
    triggerKey: "h",
    section: "kanban",
    label: "Move between columns",
  },
  {
    id: "kanban.col_right",
    key: "l",
    triggerKey: "l",
    section: "kanban",
    label: "Move between columns",
  },
  {
    id: "kanban.row_down",
    key: "j",
    triggerKey: "j",
    section: "kanban",
    label: "Move within column",
  },
  {
    id: "kanban.row_up",
    key: "k",
    triggerKey: "k",
    section: "kanban",
    label: "Move within column",
  },
  {
    id: "kanban.move_task_left",
    key: "H",
    triggerKey: "H",
    configurable: false,
    section: "kanban",
    label: "Move task left",
  },
  {
    id: "kanban.move_task_right",
    key: "L",
    triggerKey: "L",
    configurable: false,
    section: "kanban",
    label: "Move task right",
  },
  {
    id: "kanban.swap_col_left",
    key: "<",
    triggerKey: "<",
    section: "kanban",
    label: "Swap column left",
  },
  {
    id: "kanban.swap_col_right",
    key: ">",
    triggerKey: ">",
    section: "kanban",
    label: "Swap column right",
  },
  {
    id: "kanban.jump_waiting",
    key: "W",
    triggerKey: "W",
    section: "kanban",
    label: "Jump to Waiting column",
  },
  {
    id: "kanban.jump_in_progress",
    key: "I",
    triggerKey: "I",
    section: "kanban",
    label: "Jump to In Progress column",
  },
  {
    id: "kanban.jump_blocked",
    key: "B",
    triggerKey: "B",
    section: "kanban",
    label: "Jump to Blocked column",
  },
  {
    id: "kanban.jump_done",
    key: "X",
    triggerKey: "X",
    section: "kanban",
    label: "Jump to Done column",
  },
  {
    id: "kanban.set_waiting",
    key: "w",
    triggerKey: "w",
    configurable: false,
    section: "kanban",
    label: "Set status Waiting",
  },
  {
    id: "kanban.set_in_progress",
    key: "i",
    triggerKey: "i",
    configurable: false,
    section: "kanban",
    label: "Set status In Progress",
  },
  {
    id: "kanban.set_blocked",
    key: "b",
    triggerKey: "b",
    configurable: false,
    section: "kanban",
    label: "Set status Blocked",
  },
  {
    id: "kanban.complete",
    key: "x",
    triggerKey: "x",
    configurable: false,
    section: "kanban",
    label: "Complete task",
  },
  {
    id: "kanban.search",
    key: "/",
    triggerKey: "/",
    section: "kanban",
    label: "Search filter",
  },
  {
    id: "kanban.edit",
    key: "e",
    triggerKey: "e",
    section: "kanban",
    label: "Edit / create task",
  },
  {
    id: "kanban.toggle_select",
    key: "v",
    triggerKey: "v",
    section: "kanban",
    label: "Toggle select",
  },
  {
    id: "kanban.visual_mode",
    key: "V",
    triggerKey: "V",
    section: "kanban",
    label: "Visual select mode",
  },
  {
    id: "kanban.delete",
    key: "dd",
    triggerKey: "d",
    configurable: false,
    section: "kanban",
    label: "Delete task",
  },
  {
    id: "kanban.escape",
    key: "Escape",
    triggerKey: "Escape",
    section: "kanban",
    label: "Deactivate keyboard",
  },

  {
    id: "calendar.prev_period",
    key: "h",
    triggerKey: "h",
    section: "calendar",
    label: "Previous period",
  },
  {
    id: "calendar.next_period",
    key: "l",
    triggerKey: "l",
    section: "calendar",
    label: "Next period",
  },
  {
    id: "calendar.scroll_top",
    key: "gg",
    triggerKey: "g",
    configurable: false,
    section: "calendar",
    label: "First hour (00:00)",
  },
  {
    id: "calendar.scroll_bottom",
    key: "G",
    triggerKey: "G",
    configurable: false,
    section: "calendar",
    label: "Last hour (23:00)",
  },
  {
    id: "calendar.scroll_down_hour",
    key: "e",
    triggerKey: "e",
    modifiers: ["ctrl"],
    configurable: false,
    section: "calendar",
    label: "Scroll down 1 hour",
  },
  {
    id: "calendar.scroll_up_hour",
    key: "y",
    triggerKey: "y",
    modifiers: ["ctrl"],
    configurable: false,
    section: "calendar",
    label: "Scroll up 1 hour",
  },
  {
    id: "calendar.half_page_down",
    key: "d",
    triggerKey: "d",
    modifiers: ["ctrl"],
    configurable: false,
    section: "calendar",
    label: "Scroll half page down",
  },
  {
    id: "calendar.half_page_up",
    key: "u",
    triggerKey: "u",
    modifiers: ["ctrl"],
    configurable: false,
    section: "calendar",
    label: "Scroll half page up",
  },
  {
    id: "calendar.week_view",
    key: "w",
    triggerKey: "w",
    section: "calendar",
    label: "Week view",
  },
  {
    id: "calendar.month_view",
    key: "m",
    triggerKey: "m",
    section: "calendar",
    label: "Month view",
  },
  {
    id: "calendar.today",
    key: "t",
    triggerKey: "t",
    section: "calendar",
    label: "Jump to today",
  },
  {
    id: "calendar.toggle_allday",
    key: "a",
    triggerKey: "a",
    section: "calendar",
    label: "Toggle all-day bar",
  },
  {
    id: "calendar.delete",
    key: "dd",
    triggerKey: "d",
    configurable: false,
    section: "calendar",
    label: "Delete event",
  },
  {
    id: "calendar.actions",
    key: "a",
    triggerKey: "a",
    section: "calendar",
    label: "Calendar management",
  },

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
  {
    id: "task_detail.yank_link",
    key: "yy",
    triggerKey: "y",
    configurable: false,
    section: "task_detail",
    label: "Copy share link",
  },
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

export function matchesEvent(id: string, e: KeyboardEvent): boolean {
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

const BROWSER_RESERVED_COMBOS = new Set([
  "ctrl+w",
  "ctrl+t",
  "ctrl+n",
  "ctrl+Tab",
]);

const BROWSER_RESERVED_KEYS = new Set(["F1", "F3", "F5", "F11", "F12"]);

export function isBrowserReserved(e: KeyboardEvent): boolean {
  if (BROWSER_RESERVED_KEYS.has(e.key)) return true;
  if (e.ctrlKey) {
    const combo = `ctrl+${e.key}`;
    if (BROWSER_RESERVED_COMBOS.has(combo)) return true;
  }
  return false;
}

export function isModifierOnly(key: string): boolean {
  return (
    key === "Shift" || key === "Control" || key === "Alt" || key === "Meta"
  );
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

function row(
  ids: string | string[],
  keyDisplay: string,
  label: string,
): HelpRow {
  return { ids: Array.isArray(ids) ? ids : [ids], keyDisplay, label };
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    section: "global",
    rows: [
      row("global.queue", "Q", "Queue view"),
      row("global.kanban", "K", "Kanban view"),
      row("global.calendar", "C", "Calendar view"),
      row("global.settings", "S", "Settings"),
      row(
        ["global.calendar_week", "global.calendar_month"],
        "w / m",
        "Calendar week / month view",
      ),
      row("global.toggle_sidebar", "-", "Toggle sidebar"),
      row("global.logout", "q", "Logout"),
      row("global.undo", "u", "Undo"),
      row("global.category_jump", "g1-9", "Jump to category"),
      row("global.create_task", "gc", "Create task"),
      row("global.toggle_done", "g.", "Toggle done tasks"),
      row("global.help", "g?", "This help"),
    ],
  },
  {
    section: "queue",
    rows: [
      row(["queue.move_down", "queue.move_up"], "j / k", "Move down / up"),
      row("queue.jump_top", "gg", "Jump to top"),
      row("queue.jump_bottom", "G", "Jump to bottom"),
      row("queue.half_page_down", "<C-d>", "Half page down"),
      row("queue.half_page_up", "<C-u>", "Half page up"),
      row("queue.search", "/", "Search filter"),
      row("queue.edit", "e", "Edit / create task"),
      row("queue.complete", "xx / xj / xk", "Complete task(s)"),
      row("queue.delete", "dd / dj / dk", "Delete task(s)"),
      row("queue.set_pending", "pp / pj / pk", "Set pending"),
      row("queue.set_wip", "ww / wj / wk", "Set wip"),
      row("queue.set_blocked", "bb / bj / bk", "Set blocked"),
      row("queue.toggle_select", "v", "Toggle select"),
      row("queue.visual_mode", "V", "Visual select mode"),
      row("queue.escape", "<Esc>", "Clear / close"),
    ],
  },
  {
    section: "kanban",
    rows: [
      row(
        ["kanban.col_left", "kanban.col_right"],
        "h / l",
        "Move between columns",
      ),
      row(["kanban.row_down", "kanban.row_up"], "j / k", "Move within column"),
      row(
        ["kanban.move_task_left", "kanban.move_task_right"],
        "H / L",
        "Move task left / right",
      ),
      row(
        ["kanban.swap_col_left", "kanban.swap_col_right"],
        "< / >",
        "Swap column left / right",
      ),
      row(
        [
          "kanban.jump_waiting",
          "kanban.jump_in_progress",
          "kanban.jump_blocked",
          "kanban.jump_done",
        ],
        "W / I / B / X",
        "Jump to column",
      ),
      row(
        [
          "kanban.set_waiting",
          "kanban.set_in_progress",
          "kanban.set_blocked",
          "kanban.complete",
        ],
        "w / i / b / x",
        "Set status / complete",
      ),
      row("kanban.search", "/", "Search filter"),
      row("kanban.edit", "e", "Edit / create task"),
      row(
        ["kanban.toggle_select", "kanban.visual_mode"],
        "v / V",
        "Toggle / visual select",
      ),
      row("kanban.delete", "dd", "Delete task"),
      row("kanban.escape", "<Esc>", "Deactivate keyboard"),
    ],
  },
  {
    section: "calendar",
    rows: [
      row(
        ["calendar.prev_period", "calendar.next_period"],
        "h / l",
        "Previous / next period",
      ),
      row("calendar.scroll_top", "gg", "First hour (00:00)"),
      row("calendar.scroll_bottom", "G", "Last hour (23:00)"),
      row("calendar.scroll_down_hour", "<C-e>", "Scroll down 1 hour"),
      row("calendar.scroll_up_hour", "<C-y>", "Scroll up 1 hour"),
      row("calendar.half_page_down", "<C-d>", "Scroll half page down"),
      row("calendar.half_page_up", "<C-u>", "Scroll half page up"),
      row(
        ["calendar.week_view", "calendar.month_view"],
        "w / m",
        "Week / month view",
      ),
      row("calendar.today", "t", "Jump to today"),
      row("calendar.toggle_allday", "a", "Toggle all-day bar"),
      row("calendar.delete", "dd", "Delete event"),
      row("calendar.actions", "ga", "Calendar management"),
    ],
  },
  {
    section: "navigation",
    rows: [
      row("nav.jump_back", "<C-o>", "Jump back"),
      row("nav.jump_forward", "<C-i>", "Jump forward"),
      row("nav.alternate", "<C-6>", "Alternate buffer"),
    ],
  },
  {
    section: "task_detail",
    rows: [
      row("task_detail.save", "<C-s>", "Save"),
      row("task_detail.close", "<Esc>", "Close"),
      row("task_detail.create", "<CR>", "Create (in new task mode)"),
      row("task_detail.yank_link", "yy", "Copy share link"),
    ],
  },
];
