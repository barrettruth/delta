import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEYMAPS,
  getKeymap,
  HELP_SECTIONS,
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

describe("keymap definitions", () => {
  it("resolves static keymap definitions by id", () => {
    expect(getKeymap("global.help")).toEqual(
      expect.objectContaining({
        id: "global.help",
        triggerKey: "g",
        key: "g?",
        label: "This help",
      }),
    );
    expect(() => getKeymap("global.missing")).toThrow(
      "Unknown keymap id: global.missing",
    );
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

  it("falls back to global shortcuts across the settings area", () => {
    expect(sectionsForPath("/settings")).toEqual(["global"]);
    expect(sectionsForPath("/settings/calendar")).toEqual(["global"]);
    expect(sectionsForPath("/settings/preferences/advanced")).toEqual([
      "global",
    ]);
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

  it("documents calendar traversal and view shortcuts", () => {
    const calendar = HELP_SECTIONS.find(
      (section) => section.section === "calendar",
    );

    expect(calendar?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ids: ["calendar.prev_period", "calendar.next_period"],
          keyDisplay: "h / l",
          label: "Previous / next day, week, or month",
        }),
        expect.objectContaining({
          ids: [
            "calendar.day_view",
            "calendar.week_view",
            "calendar.month_view",
          ],
          keyDisplay: "D / w / m",
          label: "Day / week / month view",
        }),
      ]),
    );
  });
});
