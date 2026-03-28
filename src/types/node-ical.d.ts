declare module "node-ical" {
  export type ParameterValue = string | string[] | undefined;

  export interface DateWithTimeZone extends Date {
    tz?: string;
  }

  export interface VEvent {
    type: "VEVENT";
    uid: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: DateWithTimeZone;
    end?: DateWithTimeZone;
    rrule?: {
      toString(): string;
    };
    recurrences?: Record<string, VEvent>;
    exdate?: Record<string, DateWithTimeZone>;
    categories?: ParameterValue[];
    status?: string;
    [key: string]: unknown;
  }

  export interface CalendarComponent {
    type: string;
    [key: string]: unknown;
  }

  export function parseICS(
    data: string,
  ): Record<string, CalendarComponent | VEvent>;

  const ical: {
    parseICS: typeof parseICS;
  };

  export default ical;
}
