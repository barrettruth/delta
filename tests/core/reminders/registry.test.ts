import { describe, expect, it } from "vitest";
import {
  getReminderAdapter,
  listReminderAdapters,
} from "@/core/reminders/registry";
import {
  isReminderAdapterKey,
  isReminderAnchor,
  isReminderChannel,
  isReminderDeliveryStatus,
  REMINDER_ADAPTER_KEYS,
  REMINDER_ANCHORS,
  REMINDER_CHANNELS,
  REMINDER_DELIVERY_STATUSES,
} from "@/core/reminders/types";

describe("reminder type guards", () => {
  it("accepts known adapter keys", () => {
    for (const key of REMINDER_ADAPTER_KEYS) {
      expect(isReminderAdapterKey(key)).toBe(true);
    }
    expect(isReminderAdapterKey("sms.unknown")).toBe(false);
  });

  it("accepts known channels", () => {
    for (const channel of REMINDER_CHANNELS) {
      expect(isReminderChannel(channel)).toBe(true);
    }
    expect(isReminderChannel("email")).toBe(false);
  });

  it("accepts known anchors", () => {
    for (const anchor of REMINDER_ANCHORS) {
      expect(isReminderAnchor(anchor)).toBe(true);
    }
    expect(isReminderAnchor("custom")).toBe(false);
  });

  it("accepts known delivery statuses", () => {
    for (const status of REMINDER_DELIVERY_STATUSES) {
      expect(isReminderDeliveryStatus(status)).toBe(true);
    }
    expect(isReminderDeliveryStatus("queued")).toBe(false);
  });
});

describe("reminder adapter registry", () => {
  it("lists all supported adapters", () => {
    const manifests = listReminderAdapters();

    expect(manifests.map((manifest) => manifest.key)).toEqual([
      ...REMINDER_ADAPTER_KEYS,
    ]);
  });

  it("returns adapter metadata by key", () => {
    const adapter = getReminderAdapter("whatsapp.twilio");

    expect(adapter).not.toBeNull();
    expect(adapter?.channel).toBe("whatsapp");
    expect(adapter?.configScope).toBe("system");
    expect(adapter?.capabilities.beta).toBe(false);
    expect(adapter?.capabilities.supportsDeliveryStatus).toBe(true);
  });

  it("returns null for unknown adapters", () => {
    expect(getReminderAdapter("sms.telnyx")).toBeNull();
  });

  it("returns defensive copies", () => {
    const manifests = listReminderAdapters();
    manifests[0].displayName = "mutated";

    const fresh = getReminderAdapter("sms.twilio");
    expect(fresh?.displayName).toBe("Twilio SMS");
  });
});
