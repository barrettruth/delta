export const SETTINGS_SECTIONS = [
  { id: "account", label: "account", href: "/settings" },
  { id: "security", label: "security", href: "/settings/security" },
  { id: "keymaps", label: "keymaps", href: "/settings/keymaps" },
  { id: "calendar", label: "calendar", href: "/settings/calendar" },
  { id: "integrations", label: "integrations", href: "/settings/integrations" },
  { id: "preferences", label: "preferences", href: "/settings/preferences" },
  { id: "invites", label: "invites", href: "/settings/invites" },
] as const;

export const SETTINGS_RETURN_TO_PARAM = "returnTo";

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString"> | null;

export function isSettingsPath(pathname: string | null | undefined): boolean {
  return (
    pathname === "/settings" || pathname?.startsWith("/settings/") === true
  );
}

export function isSettingsSectionActive(
  pathname: string | null | undefined,
  href: string,
): boolean {
  if (href === "/settings") return pathname === href;
  return pathname === href || pathname?.startsWith(`${href}/`) === true;
}

export function getActiveSettingsIndex(
  pathname: string | null | undefined,
): number {
  const exact = SETTINGS_SECTIONS.findIndex(
    (section) => section.href === pathname,
  );
  if (exact >= 0) return exact;

  const prefixed = SETTINGS_SECTIONS.findIndex((section) =>
    isSettingsSectionActive(pathname, section.href),
  );
  return prefixed >= 0 ? prefixed : 0;
}

export function getActiveSettingsSection(
  pathname: string | null | undefined,
): SettingsSection {
  return SETTINGS_SECTIONS[getActiveSettingsIndex(pathname)];
}

export function pathWithSearch(
  pathname: string | null | undefined,
  searchParams: SearchParamsLike,
): string {
  const query = searchParams?.toString() ?? "";
  const path = pathname ?? "/";
  return query ? `${path}?${query}` : path;
}

export function safeSettingsReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  const pathname = value.split(/[?#]/, 1)[0];
  return isSettingsPath(pathname) ? "/" : value;
}

export function settingsReturnToForPath(
  pathname: string | null | undefined,
  searchParams: SearchParamsLike,
): string {
  if (isSettingsPath(pathname)) {
    return safeSettingsReturnTo(searchParams?.get(SETTINGS_RETURN_TO_PARAM));
  }
  return pathWithSearch(pathname, searchParams);
}

export function settingsHref(
  href: string,
  returnTo: string | null | undefined,
  extraParams?: Record<string, string | null | undefined>,
): string {
  const [pathname, existingQuery = ""] = href.split("?", 2);
  const params = new URLSearchParams(existingQuery);
  const safeReturnTo = safeSettingsReturnTo(returnTo);
  if (safeReturnTo !== "/") {
    params.set(SETTINGS_RETURN_TO_PARAM, safeReturnTo);
  }

  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) params.set(key, value);
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
