export const EXTERNAL_LINK_PROVIDER = {
  ical: "ical",
  googleCalendar: "google_calendar",
  googleTasks: "google_tasks",
} as const;

export type ExternalLinkProviderId =
  (typeof EXTERNAL_LINK_PROVIDER)[keyof typeof EXTERNAL_LINK_PROVIDER];

export const EXTERNAL_LINK_PROVIDERS = [
  EXTERNAL_LINK_PROVIDER.ical,
  EXTERNAL_LINK_PROVIDER.googleCalendar,
  EXTERNAL_LINK_PROVIDER.googleTasks,
] as const satisfies readonly ExternalLinkProviderId[];

const EXTERNAL_LINK_PROVIDER_SET: ReadonlySet<string> = new Set(
  EXTERNAL_LINK_PROVIDERS,
);

export function isExternalLinkProviderId(
  provider: string,
): provider is ExternalLinkProviderId {
  return EXTERNAL_LINK_PROVIDER_SET.has(provider);
}
