export const SETTINGS_SECTIONS = [
  { id: "account", label: "account", href: "/settings" },
  { id: "security", label: "security", href: "/settings/security" },
  { id: "keymaps", label: "keymaps", href: "/settings/keymaps" },
  { id: "calendar", label: "calendar", href: "/settings/calendar" },
  { id: "integrations", label: "integrations", href: "/settings/integrations" },
  { id: "preferences", label: "preferences", href: "/settings/preferences" },
  { id: "invites", label: "invites", href: "/settings/invites" },
] as const;

export function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function isSettingsSectionActive(
  pathname: string,
  href: string,
): boolean {
  if (href === "/settings") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
