import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_TASKS_LINK_PROVIDER = EXTERNAL_LINK_PROVIDER.googleTasks;

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
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
  lists?: Record<string, GoogleTaskListSyncState>;
}

export interface GoogleTaskListSyncState {
  title?: string;
  updatedMin?: string;
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

export interface GoogleTasksPullSummary {
  lists: number;
  seen: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
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
