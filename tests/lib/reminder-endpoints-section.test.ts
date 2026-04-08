import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReminderEndpointsSection } from "@/components/settings/reminder-endpoints-section";
import { StatusBarProvider } from "@/contexts/status-bar";
import { getEmptyReminderTransportConfigStatus } from "@/lib/reminder-transport-form";

describe("ReminderEndpointsSection", () => {
  it("shows inline provider fields instead of a set-up button when setup is missing", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(ReminderEndpointsSection, {
          initialDeliveries: [],
          initialEndpoints: [],
          initialTransportConfigs: [
            getEmptyReminderTransportConfigStatus("sms.twilio"),
          ],
          adapters: [
            {
              key: "sms.twilio",
              channel: "sms",
              displayName: "Twilio SMS",
              configScope: "system",
              capabilities: {
                supportsDeliveryStatus: true,
                supportsRichText: false,
                supportsTestSend: true,
                beta: false,
              },
            },
          ],
        }),
      ),
    );

    expect(html).toContain("provider setup");
    expect(html).toContain(
      "Finish provider setup before testing or sending reminders.",
    );
    expect(html).toContain('placeholder="AC123456789"');
    expect(html).toContain("save setup");
    expect(html).not.toContain("set up provider");
  });
});
