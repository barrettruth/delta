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
  useSearchParams: () => new URLSearchParams(),
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
            calendarLastPulledAt: null,
            calendarLastError: null,
            calendarLastResult: null,
            calendarSources: [],
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
    expect(html).toContain("google calendars");
    expect(html).toContain("pull now (last pull: never)");
    expect(html).toContain("refresh calendars (no calendars discovered)");
  });

  it("renders Google Tasks pull summary", () => {
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
              duplicateSkipped: 1,
              errors: [],
            },
            calendarLastPulledAt: null,
            calendarLastError: null,
            calendarLastResult: null,
            calendarSources: [],
          },
        }),
      ),
    );

    expect(html).toContain("last result");
    expect(html).toContain(
      "12 seen / 3 created / 4 updated / 2 skipped / 1 duplicate skipped",
    );
    expect(html).not.toContain("sync issues");
  });

  it("renders selected and hidden Google Calendar sources", () => {
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
            tasksLastPulledAt: null,
            tasksLastError: null,
            tasksLastResult: null,
            calendarLastPulledAt: "2026-05-13T04:30:00.000Z",
            calendarLastError: null,
            calendarLastResult: {
              sources: 2,
              seen: 5,
              created: 2,
              updated: 1,
              cancelled: 1,
              skipped: 1,
              duplicateSkipped: 1,
              fullResyncs: 1,
              errors: [],
            },
            calendarSources: [
              {
                id: 1,
                sourceId: "visible@example.com",
                title: "Work",
                enabled: true,
                hidden: false,
                accessRole: "owner",
                timeZone: "America/New_York",
                defaultCategory: "Work",
                backgroundColor: "#2952a3",
                foregroundColor: "#ffffff",
              },
              {
                id: 2,
                sourceId: "hidden@example.com",
                title: "Archive",
                enabled: false,
                hidden: true,
                accessRole: "reader",
                timeZone: "America/New_York",
                defaultCategory: "Archive",
                backgroundColor: "#7bd148",
                foregroundColor: "#000000",
              },
            ],
          },
        }),
      ),
    );

    expect(html).toContain("Work");
    expect(html).toContain("on / Work");
    expect(html).toContain(
      "5 seen / 2 created / 1 updated / 1 cancelled / 1 skipped / 1 duplicate skipped / 1 full resync",
    );
    expect(html).toContain("Archive [hidden]");
    expect(html).toContain("off / Archive");
  });
});
