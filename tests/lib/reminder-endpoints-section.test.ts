import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReminderEndpointsSection } from "@/components/settings/reminder-endpoints-section";
import { StatusBarProvider } from "@/contexts/status-bar";
import { getEmptyReminderTransportConfigStatus } from "@/lib/reminder-transport-form";

describe("ReminderEndpointsSection", () => {
  it("renders adapters collapsed by default without auto-opening setup forms", () => {
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

    expect(html).toContain("SMS");
    expect(html).toContain("needs setup");
    expect(html).not.toContain('placeholder="AC123456789"');
    expect(html).not.toContain(
      "Finish provider setup before testing or sending reminders.",
    );
  });
});
