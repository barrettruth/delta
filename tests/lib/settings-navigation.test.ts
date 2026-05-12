import { describe, expect, it } from "vitest";
import {
  getActiveSettingsIndex,
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
    expect(
      SETTINGS_SECTIONS.map(({ id, label, href }) => ({ id, label, href })),
    ).toEqual([
      { id: "account", label: "account", href: "/settings" },
      { id: "calendar", label: "calendar", href: "/settings/calendar" },
      {
        id: "preferences",
        label: "preferences",
        href: "/settings/preferences",
      },
      {
        id: "shortcuts",
        label: "shortcuts",
        href: "/settings/shortcuts",
      },
    ]);
  });

  it("matches the full settings area for the main app sidebar", () => {
    expect(isSettingsPath("/settings")).toBe(true);
    expect(isSettingsPath("/settings/calendar")).toBe(true);
    expect(isSettingsPath("/settings/preferences/advanced")).toBe(true);
    expect(isSettingsPath("/settings/shortcuts")).toBe(true);
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
        "/settings/preferences/advanced",
        "/settings/preferences",
      ),
    ).toBe(true);
    expect(isSettingsSectionActive("/settings/calendar", "/settings")).toBe(
      false,
    );
    expect(
      isSettingsSectionActive("/settings/preferences", "/settings/calendar"),
    ).toBe(false);
    expect(
      isSettingsSectionActive("/settings/shortcuts", "/settings/shortcuts"),
    ).toBe(true);
  });

  it("resolves the active settings section", () => {
    expect(getActiveSettingsSection("/settings").id).toBe("account");
    expect(getActiveSettingsSection("/settings/calendar/sync").id).toBe(
      "calendar",
    );
    expect(getActiveSettingsSection("/settings/preferences").id).toBe(
      "preferences",
    );
    expect(getActiveSettingsSection("/settings/shortcuts").id).toBe(
      "shortcuts",
    );
    expect(getActiveSettingsSection("/nope").id).toBe("account");
  });

  it("keeps numbered settings navigation aligned to visible sections", () => {
    expect(getActiveSettingsIndex("/settings")).toBe(0);
    expect(getActiveSettingsIndex("/settings/calendar")).toBe(1);
    expect(getActiveSettingsIndex("/settings/preferences")).toBe(2);
    expect(getActiveSettingsIndex("/settings/shortcuts")).toBe(3);
  });

  it("builds settings hrefs with safe return targets", () => {
    expect(
      settingsHref("/settings/calendar", "/calendar?mode=week", {
        focus: "calendar",
      }),
    ).toBe(
      "/settings/calendar?returnTo=%2Fcalendar%3Fmode%3Dweek&focus=calendar",
    );
    expect(settingsHref("/settings", "/settings/calendar")).toBe("/settings");
    expect(settingsHref("/settings", "https://example.com")).toBe("/settings");
  });

  it("preserves dashboard return targets for modal settings links", () => {
    expect(
      settingsHref(
        "/settings",
        settingsReturnToForPath("/", new URLSearchParams("view=queue")),
      ),
    ).toBe("/settings?returnTo=%2F%3Fview%3Dqueue");
    expect(
      settingsHref(
        "/settings",
        settingsReturnToForPath("/kanban", new URLSearchParams()),
      ),
    ).toBe("/settings?returnTo=%2Fkanban");
    expect(
      settingsHref(
        "/settings/calendar",
        settingsReturnToForPath("/calendar", new URLSearchParams("mode=week")),
      ),
    ).toBe("/settings/calendar?returnTo=%2Fcalendar%3Fmode%3Dweek");
  });

  it("derives settings close targets from the current route", () => {
    const queueParams = new URLSearchParams("view=queue");
    const settingsParams = new URLSearchParams("returnTo=/calendar");

    expect(pathWithSearch("/", queueParams)).toBe("/?view=queue");
    expect(settingsReturnToForPath("/", queueParams)).toBe("/?view=queue");
    expect(settingsReturnToForPath("/settings/calendar", settingsParams)).toBe(
      "/calendar",
    );
    expect(safeSettingsReturnTo("//example.com")).toBe("/");
  });
});
