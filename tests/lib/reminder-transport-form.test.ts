import { describe, expect, it } from "vitest";
import {
  getEmptyReminderTransportConfigStatus,
  getReminderTransportFields,
  getReminderTransportStatusLabel,
  normalizeReminderTransportConfigValues,
} from "@/lib/reminder-transport-form";

describe("reminder transport form helpers", () => {
  it("returns adapter-specific field metadata", () => {
    expect(getReminderTransportFields("sms.twilio")).toEqual([
      {
        name: "accountSid",
        label: "account SID",
        placeholder: "AC123456789",
        inputType: "text",
        systemConfigKey: "reminders.sms.twilio.account_sid",
      },
      {
        name: "authToken",
        label: "auth token",
        placeholder: "auth token",
        inputType: "password",
        systemConfigKey: "reminders.sms.twilio.auth_token",
      },
      {
        name: "fromNumber",
        label: "from number",
        placeholder: "+15125550123",
        inputType: "tel",
        systemConfigKey: "reminders.sms.twilio.from_number",
      },
    ]);

    expect(getReminderTransportFields("telegram.bot_api")).toEqual([
      {
        name: "botToken",
        label: "bot token",
        placeholder: "123456:ABCDEF",
        inputType: "password",
        systemConfigKey: "reminders.telegram.bot_api.bot_token",
      },
    ]);
  });

  it("normalizes and validates reminder transport input", () => {
    expect(
      normalizeReminderTransportConfigValues("sms.twilio", {
        accountSid: " AC123 ",
        authToken: " token-123 ",
        fromNumber: " +15125550123 ",
      }),
    ).toEqual({
      ok: true,
      values: {
        accountSid: "AC123",
        authToken: "token-123",
        fromNumber: "+15125550123",
      },
    });

    expect(
      normalizeReminderTransportConfigValues("telegram.bot_api", {
        botToken: "   ",
      }),
    ).toEqual({ ok: false, error: "bot token is required" });

    expect(
      normalizeReminderTransportConfigValues("telegram.bot_api", null),
    ).toEqual({ ok: false, error: "values are required" });
  });

  it("returns user-facing status labels", () => {
    expect(
      getReminderTransportStatusLabel({
        adapterKey: "sms.twilio",
        configured: true,
        missingFields: [],
      }),
    ).toBe("configured");

    expect(
      getReminderTransportStatusLabel(
        getEmptyReminderTransportConfigStatus("sms.twilio"),
      ),
    ).toBe("needs setup");

    expect(
      getReminderTransportStatusLabel({
        adapterKey: "sms.twilio",
        configured: false,
        missingFields: ["fromNumber"],
      }),
    ).toBe("incomplete");
  });
});
