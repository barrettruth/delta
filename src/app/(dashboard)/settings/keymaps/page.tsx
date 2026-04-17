import { Suspense } from "react";
import { KeymapsSection } from "@/components/settings/keymaps-section";

export default function SettingsKeymapsPage() {
  return (
    <Suspense fallback={null}>
      <KeymapsSection />
    </Suspense>
  );
}
