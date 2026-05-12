import { describe, expect, it } from "vitest";
import {
  CALENDAR_EXTERNAL_LINK_PROVIDER,
  calendarExternalIdentity,
  calendarRecurrenceInstanceIdentity,
} from "@/core/calendar-external-identity";

describe("calendar external identity", () => {
  it("uses the upstream event id for master events", () => {
    const identity = calendarExternalIdentity({
      provider: CALENDAR_EXTERNAL_LINK_PROVIDER.ical,
      upstreamEventId: "event-uid@example.com",
    });

    expect(identity).toEqual({
      provider: CALENDAR_EXTERNAL_LINK_PROVIDER.ical,
      upstreamEventId: "event-uid@example.com",
      recurrenceInstanceIdentity: null,
      externalId: "event-uid@example.com",
    });
  });

  it("adds recurrence instance identity to recurring instance ids", () => {
    const recurrenceInstanceIdentity = calendarRecurrenceInstanceIdentity(
      new Date("2026-04-08T09:00:00.000Z"),
    );
    const identity = calendarExternalIdentity({
      provider: CALENDAR_EXTERNAL_LINK_PROVIDER.ical,
      upstreamEventId: "series@example.com",
      recurrenceInstanceIdentity,
    });

    expect(recurrenceInstanceIdentity).toBe("2026-04-08T09:00:00.000Z");
    expect(identity.externalId).toBe(
      "series@example.com::2026-04-08T09:00:00.000Z",
    );
  });

  it("keeps provider ids separate from provider-specific external ids", () => {
    const icalIdentity = calendarExternalIdentity({
      provider: CALENDAR_EXTERNAL_LINK_PROVIDER.ical,
      upstreamEventId: "shared-upstream-id",
    });
    const googleCalendarIdentity = calendarExternalIdentity({
      provider: CALENDAR_EXTERNAL_LINK_PROVIDER.googleCalendar,
      upstreamEventId: "shared-upstream-id",
    });

    expect(icalIdentity.externalId).toBe("shared-upstream-id");
    expect(googleCalendarIdentity.externalId).toBe("shared-upstream-id");
    expect(icalIdentity.provider).toBe(CALENDAR_EXTERNAL_LINK_PROVIDER.ical);
    expect(googleCalendarIdentity.provider).toBe(
      CALENDAR_EXTERNAL_LINK_PROVIDER.googleCalendar,
    );
  });
});
