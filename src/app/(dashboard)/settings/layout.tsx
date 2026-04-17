import { SettingsModalShell } from "@/components/settings-modal-shell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsModalShell>{children}</SettingsModalShell>;
}
