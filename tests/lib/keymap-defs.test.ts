import { describe, expect, it } from "vitest";
import { HELP_SECTIONS, sectionsForPath } from "@/lib/keymap-defs";

describe("keymap definitions", () => {
  it("falls back to global shortcuts across the settings area", () => {
    expect(sectionsForPath("/settings")).toEqual(["global"]);
    expect(sectionsForPath("/settings/calendar")).toEqual(["global"]);
    expect(sectionsForPath("/settings/integrations")).toEqual(["global"]);
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
});
