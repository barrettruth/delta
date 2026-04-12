import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarSettingsSection } from "@/components/settings/calendar-settings-section";
import { StatusBarProvider } from "@/contexts/status-bar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
  }),
}));

describe("CalendarSettingsSection", () => {
  it("renders calendar-specific persistent configuration in its own page", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(CalendarSettingsSection, {
          initialGeoProvider: "photon",
          initialNlpProvider: null,
        }),
      ),
    );

    expect(html).toContain("calendar");
    expect(html).toContain("location lookup");
    expect(html).toContain("recurrence parsing");
    expect(html).not.toContain("reminders");
  });
});
