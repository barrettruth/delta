import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEYMAPS,
  getKeymap,
  getKeymapsBySection,
  HELP_SECTIONS,
  helpSectionsForPath,
  matchesEvent,
  sectionsForPath,
} from "@/lib/keymap-defs";

function keyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  } as KeyboardEvent;
}

const EXPECTED_KEYMAP_IDS = [
  "global.queue",
  "global.kanban",
  "global.calendar",
  "global.settings",
  "global.calendar_settings",
  "global.calendar_day",
  "global.calendar_week",
  "global.calendar_month",
  "global.toggle_sidebar",
  "global.undo",
  "global.category_jump",
  "global.create_task",
  "global.toggle_done",
  "global.help",
  "queue.move_down",
  "queue.move_up",
  "queue.jump_top",
  "queue.jump_bottom",
  "queue.half_page_down",
  "queue.half_page_up",
  "queue.search",
  "queue.edit",
  "queue.complete",
  "queue.delete",
  "queue.set_pending",
  "queue.set_wip",
  "queue.set_blocked",
  "queue.toggle_select",
  "queue.visual_mode",
  "queue.escape",
  "kanban.col_left",
  "kanban.col_right",
  "kanban.row_down",
  "kanban.row_up",
  "kanban.move_task_left",
  "kanban.move_task_right",
  "kanban.swap_col_left",
  "kanban.swap_col_right",
  "kanban.jump_waiting",
  "kanban.jump_in_progress",
  "kanban.jump_blocked",
  "kanban.jump_done",
  "kanban.set_waiting",
  "kanban.set_in_progress",
  "kanban.set_blocked",
  "kanban.complete",
  "kanban.search",
  "kanban.edit",
  "kanban.toggle_select",
  "kanban.visual_mode",
  "kanban.delete",
  "kanban.escape",
  "calendar.focus_prev_day",
  "calendar.focus_next_day",
  "calendar.focus_prev_week",
  "calendar.focus_next_week",
  "calendar.prev_period",
  "calendar.next_period",
  "calendar.scroll_top",
  "calendar.scroll_bottom",
  "calendar.scroll_down_hour",
  "calendar.scroll_up_hour",
  "calendar.half_page_down",
  "calendar.half_page_up",
  "calendar.day_view",
  "calendar.week_view",
  "calendar.month_view",
  "calendar.today",
  "calendar.toggle_allday",
  "calendar.actions",
  "nav.jump_back",
  "nav.jump_forward",
  "nav.alternate",
  "task_detail.save",
  "task_detail.close",
  "task_detail.create",
];

describe("keymap definitions", () => {
  it("keeps the declared keymap ids stable across split modules", () => {
    const ids = DEFAULT_KEYMAPS.map((def) => def.id);

    expect(ids).toEqual(EXPECTED_KEYMAP_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves static keymap definitions by id", () => {
    expect(getKeymap("global.help")).toEqual(
      expect.objectContaining({
        id: "global.help",
        triggerKey: "g",
        key: "g?",
        label: "This help",
      }),
    );
    expect(getKeymap("calendar.day_view")).toEqual(
      expect.objectContaining({
        key: "d",
        triggerKey: "d",
      }),
    );
    expect(getKeymap("calendar.actions")).toEqual(
      expect.objectContaining({
        key: "ga",
        triggerKey: "a",
      }),
    );
    expect(getKeymap("global.calendar_settings")).toEqual(
      expect.objectContaining({
        key: "gS",
        triggerKey: "g",
        label: "Calendar settings",
      }),
    );
    expect(getKeymap("queue.delete")).toEqual(
      expect.objectContaining({
        key: "d",
        triggerKey: "d",
      }),
    );
    expect(getKeymap("queue.complete")).toEqual(
      expect.objectContaining({
        key: "x",
        triggerKey: "x",
      }),
    );
    expect(getKeymap("kanban.delete")).toEqual(
      expect.objectContaining({
        key: "d",
        triggerKey: "d",
      }),
    );
    expect(() => getKeymap("global.missing")).toThrow(
      "Unknown keymap id: global.missing",
    );
  });

  it("groups declared keymap definitions by their sections", () => {
    expect(getKeymapsBySection("calendar").map((def) => def.id)).toEqual(
      EXPECTED_KEYMAP_IDS.filter((id) => id.startsWith("calendar.")),
    );
    expect(getKeymapsBySection("task_detail").map((def) => def.id)).toEqual([
      "task_detail.save",
      "task_detail.close",
      "task_detail.create",
    ]);
  });

  it("matches static keymaps against keyboard events", () => {
    expect(
      matchesEvent("nav.jump_back", keyEvent({ key: "o", ctrlKey: true })),
    ).toBe(true);
    expect(
      matchesEvent("nav.jump_back", keyEvent({ key: "o", metaKey: true })),
    ).toBe(true);
    expect(matchesEvent("nav.jump_back", keyEvent({ key: "o" }))).toBe(false);
    expect(
      matchesEvent(
        "nav.jump_back",
        keyEvent({ key: "o", ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
  });

  it("resolves view paths to global, view, navigation, and task panel sections", () => {
    expect(sectionsForPath("/")).toEqual([
      "global",
      "queue",
      "navigation",
      "task_detail",
    ]);
    expect(sectionsForPath("/queue")).toEqual([
      "global",
      "queue",
      "navigation",
      "task_detail",
    ]);
    expect(sectionsForPath("/kanban")).toEqual([
      "global",
      "kanban",
      "navigation",
      "task_detail",
    ]);
    expect(sectionsForPath("/calendar")).toEqual([
      "global",
      "calendar",
      "navigation",
      "task_detail",
    ]);
  });

  it("falls back to global shortcuts across the settings area", () => {
    expect(sectionsForPath("/settings")).toEqual(["global"]);
    expect(sectionsForPath("/settings/calendar")).toEqual(["global"]);
    expect(sectionsForPath("/settings/preferences/advanced")).toEqual([
      "global",
    ]);
    expect(sectionsForPath("/settings/shortcuts")).toEqual(["global"]);
  });

  it("filters shortcut help to the current view", () => {
    expect(helpSectionsForPath("/").map((section) => section.section)).toEqual([
      "global",
      "queue",
      "navigation",
      "task_detail",
    ]);
    expect(
      helpSectionsForPath("/calendar").map((section) => section.section),
    ).toEqual(["global", "calendar", "navigation", "task_detail"]);
    expect(
      helpSectionsForPath("/calendar").some(
        (section) =>
          section.section === "queue" || section.section === "kanban",
      ),
    ).toBe(false);
    expect(
      helpSectionsForPath("/settings").map((section) => section.section),
    ).toEqual(["global"]);
  });

  it("does not advertise settings-specific movement shortcuts", () => {
    expect(
      HELP_SECTIONS.some((section) =>
        section.rows.some(
          (row) =>
            row.keyDisplay === "j / k" &&
            row.label === "Move between settings sections",
        ),
      ),
    ).toBe(false);
  });

  it("keeps the shortcuts help backed by declared keymap ids", () => {
    const keymapIds = new Set(DEFAULT_KEYMAPS.map((def) => def.id));

    for (const section of HELP_SECTIONS) {
      expect(section.rows.length).toBeGreaterThan(0);
      for (const row of section.rows) {
        for (const id of row.ids) {
          expect(keymapIds.has(id)).toBe(true);
        }
      }
    }
  });

  it("advertises every declared keymap id in shortcuts help", () => {
    const helpIds = new Set(
      HELP_SECTIONS.flatMap((section) =>
        section.rows.flatMap((row) => row.ids),
      ),
    );

    expect(
      DEFAULT_KEYMAPS.map((def) => def.id).filter((id) => !helpIds.has(id)),
    ).toEqual([]);
  });

  it("keeps keymap definitions free of customization metadata", () => {
    expect(DEFAULT_KEYMAPS.some((def) => "configurable" in def)).toBe(false);
  });

  it("documents calendar traversal and view shortcuts", () => {
    const calendar = HELP_SECTIONS.find(
      (section) => section.section === "calendar",
    );

    expect(calendar?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ids: ["calendar.focus_prev_day", "calendar.focus_next_day"],
          keyDisplay: "h / l",
          label: "Focus previous / next day",
        }),
        expect.objectContaining({
          ids: ["calendar.focus_prev_week", "calendar.focus_next_week"],
          keyDisplay: "k / j",
          label: "Focus previous / next week",
        }),
        expect.objectContaining({
          ids: ["calendar.prev_period", "calendar.next_period"],
          keyDisplay: "[ / ]",
          label: "Previous / next visible period",
        }),
        expect.objectContaining({
          ids: [
            "calendar.day_view",
            "calendar.week_view",
            "calendar.month_view",
          ],
          keyDisplay: "d / w / m",
          label: "Day / week / month view",
        }),
      ]),
    );
  });

  it("keeps queue and kanban help free of operator-motion shortcuts", () => {
    const keyDisplays = HELP_SECTIONS.flatMap((section) =>
      section.rows.map((row) => row.keyDisplay),
    );
    const removedOperatorKeys = [
      ["d", "d"],
      ["d", "j"],
      ["d", "k"],
      ["x", "x"],
      ["x", "j"],
      ["x", "k"],
    ].map((parts) => parts.join(""));

    for (const key of removedOperatorKeys) {
      expect(keyDisplays).not.toContain(key);
    }
    expect(keyDisplays).toContain("d");
    expect(keyDisplays).toContain("x");
  });
});
