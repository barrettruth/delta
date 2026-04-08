import { describe, expect, it } from "vitest";
import {
  isSettingsPath,
  isSettingsSectionActive,
  SETTINGS_SECTIONS,
} from "@/lib/settings-navigation";

describe("settings navigation helpers", () => {
  it("defines the expected settings sections", () => {
    expect(SETTINGS_SECTIONS.map((section) => section.href)).toEqual([
      "/settings",
      "/settings/security",
      "/settings/keymaps",
      "/settings/integrations",
      "/settings/preferences",
      "/settings/invites",
    ]);
  });

  it("matches the full settings area for the main app sidebar", () => {
    expect(isSettingsPath("/settings")).toBe(true);
    expect(isSettingsPath("/settings/integrations")).toBe(true);
    expect(isSettingsPath("/settings/preferences/advanced")).toBe(true);
    expect(isSettingsPath("/calendar")).toBe(false);
  });

  it("matches only the active section for the settings sub-navigation", () => {
    expect(isSettingsSectionActive("/settings", "/settings")).toBe(true);
    expect(
      isSettingsSectionActive(
        "/settings/integrations",
        "/settings/integrations",
      ),
    ).toBe(true);
    expect(
      isSettingsSectionActive(
        "/settings/integrations/history",
        "/settings/integrations",
      ),
    ).toBe(true);
    expect(isSettingsSectionActive("/settings/security", "/settings")).toBe(
      false,
    );
    expect(
      isSettingsSectionActive("/settings/preferences", "/settings/security"),
    ).toBe(false);
  });
});
