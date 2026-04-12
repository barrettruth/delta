import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-primitives";

describe("settings primitives", () => {
  it("renders page and section metadata for the refined settings shell", () => {
    const html = renderToStaticMarkup(
      createElement(
        SettingsPage,
        {
          title: "integrations",
          description: "Manage calendar sync and provider API keys.",
        },
        createElement(
          SettingsSection,
          {
            title: "google calendar",
            description: "Connect Google Calendar and choose sync behavior.",
          },
          createElement(SettingsRow, {
            label: "connect google calendar",
            action: true,
          }),
        ),
      ),
    );

    expect(html).toContain("integrations");
    expect(html).toContain("Manage calendar sync and provider API keys.");
    expect(html).toContain("google calendar");
    expect(html).toContain("Connect Google Calendar and choose sync behavior.");
    expect(html).toContain("connect google calendar");
  });

  it("passes through custom section layout classes", () => {
    const html = renderToStaticMarkup(
      createElement(
        SettingsSection,
        {
          title: "reminders",
          className: "xl:col-span-3",
        },
        "content",
      ),
    );

    expect(html).toContain("xl:col-span-3");
    expect(html).toContain("reminders");
    expect(html).toContain("content");
  });
});
