import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreferencesSection } from "@/components/settings/preferences-section";
import { StatusBarProvider } from "@/contexts/status-bar";
import type { UserSettings } from "@/core/settings";

const SETTINGS: UserSettings = {
  defaultCategory: "Todo",
  defaultView: "kanban",
  showCompletedTasks: true,
  urgencyWeights: {
    due: 12,
    age: 2,
    wip: 4,
    blocking: 8,
  },
};

describe("PreferencesSection", () => {
  it("renders the selected default view as a full-width choice", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(PreferencesSection, {
          settings: SETTINGS,
        }),
      ),
    );

    expect(html).toContain("default view");
    expect(html).toContain("kanban");
    expect(html).toContain("default");
    expect(html).toContain("bg-accent text-foreground");
  });
});
