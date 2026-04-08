import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteReminderTransportConfig,
  getReminderTransportConfigStatus,
  listReminderTransportConfigStatuses,
  setReminderTransportConfig,
} from "@/core/reminders/transport-config";
import { getSystemConfig, setSystemConfig } from "@/core/system-config";
import type { Db } from "@/core/types";
import { createTestDb } from "../../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
});

describe("reminder transport config", () => {
  it("lists empty config status for supported transports", () => {
    expect(listReminderTransportConfigStatuses(db)).toEqual([
      {
        adapterKey: "sms.twilio",
        configured: false,
        missingFields: ["accountSid", "authToken", "fromNumber"],
      },
      {
        adapterKey: "whatsapp.twilio",
        configured: false,
        missingFields: [
          "accountSid",
          "authToken",
          "fromNumber",
          "messagingServiceSid",
          "contentSid",
        ],
      },
      {
        adapterKey: "telegram.bot_api",
        configured: false,
        missingFields: ["botToken"],
      },
    ]);
  });

  it("stores and reports Twilio transport config", () => {
    const status = setReminderTransportConfig(db, "sms.twilio", {
      accountSid: "AC123",
      authToken: "token-123",
      fromNumber: "+15125550123",
    });

    expect(status).toEqual({
      adapterKey: "sms.twilio",
      configured: true,
      missingFields: [],
    });
    expect(getSystemConfig(db, "reminders.sms.twilio.account_sid")).toBe(
      "AC123",
    );
    expect(getSystemConfig(db, "reminders.sms.twilio.auth_token")).toBe(
      "token-123",
    );
    expect(getSystemConfig(db, "reminders.sms.twilio.from_number")).toBe(
      "+15125550123",
    );
  });

  it("stores and reports WhatsApp transport config", () => {
    const status = setReminderTransportConfig(db, "whatsapp.twilio", {
      accountSid: "ACWA123",
      authToken: "wa-token-123",
      fromNumber: "+15125550124",
      messagingServiceSid: "MG123456789",
      contentSid: "HX123456789",
    });

    expect(status).toEqual({
      adapterKey: "whatsapp.twilio",
      configured: true,
      missingFields: [],
    });
    expect(getSystemConfig(db, "reminders.whatsapp.twilio.account_sid")).toBe(
      "ACWA123",
    );
    expect(getSystemConfig(db, "reminders.whatsapp.twilio.auth_token")).toBe(
      "wa-token-123",
    );
    expect(getSystemConfig(db, "reminders.whatsapp.twilio.from_number")).toBe(
      "+15125550124",
    );
    expect(
      getSystemConfig(db, "reminders.whatsapp.twilio.messaging_service_sid"),
    ).toBe("MG123456789");
    expect(getSystemConfig(db, "reminders.whatsapp.twilio.content_sid")).toBe(
      "HX123456789",
    );
  });

  it("reports incomplete config when fields are missing", () => {
    setSystemConfig(db, "reminders.sms.twilio.account_sid", "AC123");

    expect(getReminderTransportConfigStatus(db, "sms.twilio")).toEqual({
      adapterKey: "sms.twilio",
      configured: false,
      missingFields: ["authToken", "fromNumber"],
    });
  });

  it("deletes stored transport config keys", () => {
    setReminderTransportConfig(db, "telegram.bot_api", {
      botToken: "bot-123",
    });

    expect(deleteReminderTransportConfig(db, "telegram.bot_api")).toEqual({
      deleted: true,
      status: {
        adapterKey: "telegram.bot_api",
        configured: false,
        missingFields: ["botToken"],
      },
    });
    expect(getSystemConfig(db, "reminders.telegram.bot_api.bot_token")).toBe(
      null,
    );
  });
});
