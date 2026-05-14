import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import type { TaskStatus } from "@/core/types";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_TASKS_LINK_PROVIDER = EXTERNAL_LINK_PROVIDER.googleTasks;

export const GOOGLE_CALENDAR_LIST_SCOPE =
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  GOOGLE_CALENDAR_LIST_SCOPE,
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  "https://www.googleapis.com/auth/tasks.readonly",
] as const;

export const GOOGLE_TASKS_SCOPE =
  "https://www.googleapis.com/auth/tasks.readonly";

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  tokenType?: string;
}

export interface GoogleIntegrationMetadata {
  email?: string;
  name?: string;
  grantedScopes?: string[];
  connectedAt?: string;
  lastRefreshAt?: string;
  tasks?: GoogleTasksSyncMetadata;
  lastError?: string;
  [key: string]: unknown;
}

export interface GoogleTasksSyncMetadata {
  lastPulledAt?: string;
  lastResult?: GoogleTasksPullSummary;
}

export interface GoogleTaskList {
  kind?: string;
  id: string;
  etag?: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTask {
  kind?: string;
  id: string;
  etag?: string;
  title?: string;
  updated?: string;
  selfLink?: string;
  parent?: string;
  position?: string;
  notes?: string;
  status?: "needsAction" | "completed";
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  links?: Array<{ type?: string; description?: string; link?: string }>;
  webViewLink?: string;
  assignmentInfo?: Record<string, unknown>;
}

export interface GoogleCalendarListEntry {
  kind?: string;
  etag?: string;
  id: string;
  summary?: string;
  summaryOverride?: string;
  description?: string;
  location?: string;
  timeZone?: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  hidden?: boolean;
  selected?: boolean;
  primary?: boolean;
  accessRole?:
    | "none"
    | "freeBusyReader"
    | "reader"
    | "writer"
    | "owner"
    | string;
  deleted?: boolean;
}

export interface GoogleCalendarSourceSummary {
  id: number;
  sourceId: string;
  title: string;
  enabled: boolean;
  hidden: boolean;
  accessRole: string | null;
  timeZone: string | null;
  defaultCategory: string;
  backgroundColor: string | null;
  foregroundColor: string | null;
}

export interface GoogleCalendarEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  kind?: string;
  etag?: string;
  id: string;
  status?: "confirmed" | "tentative" | "cancelled" | string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  creator?: Record<string, unknown>;
  organizer?: Record<string, unknown>;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
  endTimeUnspecified?: boolean;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleCalendarEventDateTime;
  iCalUID?: string;
  sequence?: number;
  attendees?: Array<Record<string, unknown>>;
  attendeesOmitted?: boolean;
  hangoutLink?: string;
  conferenceData?: Record<string, unknown>;
  reminders?: Record<string, unknown>;
  source?: Record<string, unknown>;
  attachments?: Array<Record<string, unknown>>;
  eventType?: string;
  transparency?: "opaque" | "transparent" | string;
  visibility?: "default" | "public" | "private" | "confidential" | string;
  extendedProperties?: Record<string, unknown>;
  guestsCanInviteOthers?: boolean;
  guestsCanModify?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  locked?: boolean;
  privateCopy?: boolean;
  [key: string]: unknown;
}

export interface GoogleTasksPullSummary {
  lists: number;
  seen: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  duplicateSkipped: number;
  errors: string[];
}

export interface GoogleTasksMappedSnapshot {
  description: string;
  notes: string | null;
  due: string | null;
  status: TaskStatus;
  completedAt: string | null;
  category: string | null;
}

export interface GoogleTasksMappedTask {
  externalId: string;
  input: {
    description: string;
    status: "pending" | "done" | "cancelled";
    category: string;
    due?: string | null;
    completedAt?: string | null;
    notes?: string | null;
  };
  metadata: Record<string, unknown>;
}
