import { describe, expect, it } from "vitest";
import {
  getReminderEndpointAdapterHint,
  getReminderEndpointTargetLabel,
  getReminderEndpointTargetPlaceholder,
} from "@/lib/reminder-endpoint-form";

describe("reminder endpoint form helpers", () => {
  it("returns adapter-specific target labels", () => {
    expect(getReminderEndpointTargetLabel("sms.twilio")).toBe("phone number");
    expect(getReminderEndpointTargetLabel("telegram.bot_api")).toBe("chat id");
    expect(getReminderEndpointTargetLabel("slack.webhook")).toBe("webhook URL");
    expect(getReminderEndpointTargetLabel("signal.signal_cli")).toBe(
      "recipient",
    );
  });

  it("returns adapter-specific target placeholders", () => {
    expect(getReminderEndpointTargetPlaceholder("sms.twilio")).toBe(
      "+15125550123",
    );
    expect(getReminderEndpointTargetPlaceholder("telegram.bot_api")).toBe(
      "123456789",
    );
    expect(getReminderEndpointTargetPlaceholder("discord.webhook")).toBe(
      "https://",
    );
  });

  it("returns system-config hints and Signal beta messaging", () => {
    expect(
      getReminderEndpointAdapterHint({
        key: "sms.twilio",
        configScope: "system",
        capabilities: {
          supportsDeliveryStatus: true,
          supportsRichText: false,
          supportsTestSend: true,
          beta: false,
        },
      }),
    ).toBe("requires transport config");

    expect(
      getReminderEndpointAdapterHint({
        key: "signal.signal_cli",
        configScope: "system",
        capabilities: {
          supportsDeliveryStatus: false,
          supportsRichText: false,
          supportsTestSend: true,
          beta: true,
        },
      }),
    ).toBe("beta · signal-cli is not available yet");

    expect(
      getReminderEndpointAdapterHint({
        key: "slack.webhook",
        configScope: "none",
        capabilities: {
          supportsDeliveryStatus: false,
          supportsRichText: false,
          supportsTestSend: true,
          beta: false,
        },
      }),
    ).toBeNull();
  });
});
