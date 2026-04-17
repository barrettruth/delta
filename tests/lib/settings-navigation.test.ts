import { describe, expect, it } from "vitest";
import {
  getActiveSettingsSection,
  isSettingsPath,
  isSettingsSectionActive,
  pathWithSearch,
  SETTINGS_SECTIONS,
  safeSettingsReturnTo,
  settingsHref,
  settingsReturnToForPath,
} from "@/lib/settings-navigation";

describe("settings navigation helpers", () => {
  it("defines the expected settings sections", () => {
    expect(SETTINGS_SECTIONS.map((section) => section.href)).toEqual([
      "/settings",
      "/settings/security",
      "/settings/keymaps",
      "/settings/calendar",
      "/settings/integrations",
      "/settings/preferences",
      "/settings/invites",
    ]);
  });

  it("matches the full settings area for the main app sidebar", () => {
    expect(isSettingsPath("/settings")).toBe(true);
    expect(isSettingsPath("/settings/calendar")).toBe(true);
    expect(isSettingsPath("/settings/integrations")).toBe(true);
    expect(isSettingsPath("/settings/preferences/advanced")).toBe(true);
    expect(isSettingsPath("/calendar")).toBe(false);
  });

  it("matches only the active section for the settings sub-navigation", () => {
    expect(isSettingsSectionActive("/settings", "/settings")).toBe(true);
    expect(
      isSettingsSectionActive("/settings/calendar", "/settings/calendar"),
    ).toBe(true);
    expect(
      isSettingsSectionActive("/settings/calendar/sync", "/settings/calendar"),
    ).toBe(true);
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

  it("resolves the active settings section", () => {
    expect(getActiveSettingsSection("/settings").id).toBe("account");
    expect(getActiveSettingsSection("/settings/keymaps").id).toBe("keymaps");
    expect(getActiveSettingsSection("/settings/calendar/sync").id).toBe(
      "calendar",
    );
    expect(getActiveSettingsSection("/nope").id).toBe("account");
  });

  it("builds settings hrefs with safe return targets", () => {
    expect(
      settingsHref("/settings/keymaps", "/calendar?mode=week", {
        focus: "calendar",
      }),
    ).toBe(
      "/settings/keymaps?returnTo=%2Fcalendar%3Fmode%3Dweek&focus=calendar",
    );
    expect(settingsHref("/settings", "/settings/security")).toBe("/settings");
    expect(settingsHref("/settings", "https://example.com")).toBe("/settings");
  });

  it("derives settings close targets from the current route", () => {
    const queueParams = new URLSearchParams("view=queue");
    const settingsParams = new URLSearchParams("returnTo=/calendar");

    expect(pathWithSearch("/", queueParams)).toBe("/?view=queue");
    expect(settingsReturnToForPath("/", queueParams)).toBe("/?view=queue");
    expect(settingsReturnToForPath("/settings/keymaps", settingsParams)).toBe(
      "/calendar",
    );
    expect(safeSettingsReturnTo("//example.com")).toBe("/");
  });
});
