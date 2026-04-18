import { SettingsModalShell } from "@/components/settings-modal-shell";

export default function InterceptedSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsModalShell intercepted>{children}</SettingsModalShell>;
}
