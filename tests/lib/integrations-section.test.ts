import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { StatusBarProvider } from "@/contexts/status-bar";

describe("IntegrationsSection", () => {
  it("keeps the page focused on reminder setup", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(IntegrationsSection, {
          initialReminderDeliveries: [],
          initialReminderEndpoints: [],
          initialReminderTransportConfigs: [],
          reminderAdapters: [],
        }),
      ),
    );

    expect(html).toContain("integrations");
    expect(html).toContain("Set up where delta can send reminders.");
    expect(html).not.toContain("google calendar");
    expect(html).not.toContain("geocoding");
    expect(html).not.toContain("recurrence NLP");
  });
});
