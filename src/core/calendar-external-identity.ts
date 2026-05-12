import { EXTERNAL_LINK_PROVIDER } from "./external-link-providers";

export const CALENDAR_EXTERNAL_LINK_PROVIDER = {
  ical: EXTERNAL_LINK_PROVIDER.ical,
  googleCalendar: EXTERNAL_LINK_PROVIDER.googleCalendar,
} as const;

export type CalendarExternalLinkProviderId =
  (typeof CALENDAR_EXTERNAL_LINK_PROVIDER)[keyof typeof CALENDAR_EXTERNAL_LINK_PROVIDER];

export interface CalendarExternalIdentityInput {
  provider: CalendarExternalLinkProviderId;
  upstreamEventId: string;
  recurrenceInstanceIdentity?: string | null;
}

export interface CalendarExternalIdentity {
  provider: CalendarExternalLinkProviderId;
  upstreamEventId: string;
  recurrenceInstanceIdentity: string | null;
  externalId: string;
}

const RECURRENCE_INSTANCE_SEPARATOR = "::";

export function calendarRecurrenceInstanceIdentity(date: Date): string {
  return date.toISOString();
}

export function calendarExternalIdentity(
  input: CalendarExternalIdentityInput,
): CalendarExternalIdentity {
  const recurrenceInstanceIdentity = input.recurrenceInstanceIdentity ?? null;

  return {
    provider: input.provider,
    upstreamEventId: input.upstreamEventId,
    recurrenceInstanceIdentity,
    externalId:
      recurrenceInstanceIdentity === null
        ? input.upstreamEventId
        : `${input.upstreamEventId}${RECURRENCE_INSTANCE_SEPARATOR}${recurrenceInstanceIdentity}`,
  };
}
