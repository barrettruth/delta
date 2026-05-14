import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TaskSourceDetails,
  TaskSourceIndicator,
} from "@/components/task-source-indicator";
import type { TaskSourceInfo } from "@/core/types";

const googleCalendarSource: TaskSourceInfo = {
  provider: "google_calendar",
  providerLabel: "Google Calendar",
  sourceKind: "google_calendar",
  sourceKindLabel: "calendar",
  sourceTitle: "Work",
  readOnly: true,
  externalId: "work@example.com:event-1",
  htmlLink: "https://calendar.google.com/event?eid=event-1",
  attributes: ["read-only", "private", "free"],
  transparency: "transparent",
};

describe("TaskSourceIndicator", () => {
  it("renders compact imported-source attributes", () => {
    const html = renderToStaticMarkup(
      createElement(TaskSourceIndicator, { source: googleCalendarSource }),
    );

    expect(html).toContain("gcal");
    expect(html).toContain("[private]");
    expect(html).toContain("[free]");
    expect(html).toContain("read-only import");
  });

  it("renders detail source metadata and Google Calendar action links", () => {
    const html = renderToStaticMarkup(
      createElement(TaskSourceDetails, { source: googleCalendarSource }),
    );

    expect(html).toContain("Work");
    expect(html).toContain("calendar");
    expect(html).toContain("open in Google Calendar");
    expect(html).toContain("https://calendar.google.com/event?eid=event-1");
  });
});
