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
          description: "Manage interoperability and provider API keys.",
        },
        createElement(
          SettingsSection,
          {
            title: "location lookup",
            description: "Choose the provider used for location lookups.",
          },
          createElement(SettingsRow, {
            label: "photon",
            action: true,
          }),
        ),
      ),
    );

    expect(html).toContain("settings");
    expect(html).toContain("integrations");
    expect(html).toContain("Manage interoperability and provider API keys.");
    expect(html).toContain("location lookup");
    expect(html).toContain("Choose the provider used for location lookups.");
    expect(html).toContain("photon");
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
