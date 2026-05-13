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
          initialGoogle: {
            connected: false,
            email: null,
            name: null,
            tasksLastPulledAt: null,
            tasksLastError: null,
            tasksLastResult: null,
          },
        }),
      ),
    );

    expect(html).toContain("calendar");
    expect(html).toContain("google");
    expect(html).toContain("recurrence");
    expect(html).not.toContain("NLP");
    expect(html).toContain("connect google");
    expect(html).toContain("google tasks");
    expect(html).toContain("pull now");
  });

  it("renders Google Tasks pull summary and sync issue counts", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(CalendarSettingsSection, {
          initialGeoProvider: "photon",
          initialNlpProvider: null,
          initialGoogle: {
            connected: true,
            email: "owner@example.com",
            name: "Owner",
            tasksLastPulledAt: "2026-05-13T03:30:00.000Z",
            tasksLastError: null,
            tasksLastResult: {
              lists: 1,
              seen: 12,
              created: 3,
              updated: 4,
              cancelled: 0,
              skipped: 2,
              keptLocal: 2,
              conflicts: 1,
              remoteOutdated: 1,
              deletedProtected: 0,
            },
          },
        }),
      ),
    );

    expect(html).toContain("last result");
    expect(html).toContain("12 seen / 3 created / 4 updated / 2 skipped");
    expect(html).toContain("sync issues");
    expect(html).toContain("2 kept local / 1 conflict / 1 remote held");
  });
});
