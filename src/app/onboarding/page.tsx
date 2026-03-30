import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/core/auth";
import { getIntegrationConfig } from "@/core/integration-config";
import { userHas2FA } from "@/core/two-factor";
import { db } from "@/db";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");

  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");
  if (!userHas2FA(db, user.id)) redirect("/setup-2fa");
  if (user.onboardingCompleted) redirect("/");

  const gcalConfig = getIntegrationConfig(db, user.id, "google_calendar");
  const gcalConnected = gcalConfig?.enabled === 1;

  let geoProvider: "photon" | "mapbox" | "google_maps" = "photon";
  for (const p of ["mapbox", "google_maps"] as const) {
    const config = getIntegrationConfig(db, user.id, p);
    if (config?.enabled === 1) {
      geoProvider = p;
      break;
    }
  }

  let nlpProvider: "builtin" | "anthropic" | "openai" = "builtin";
  let nlpModel = "";
  for (const p of ["anthropic", "openai"] as const) {
    const config = getIntegrationConfig(db, user.id, `nlp_${p}`);
    if (config?.enabled === 1) {
      nlpProvider = p;
      const meta = config.metadata as Record<string, unknown> | null;
      nlpModel = (meta?.model as string) ?? "";
      break;
    }
  }

  return (
    <OnboardingWizard
      gcalConnected={gcalConnected}
      initialGeoProvider={geoProvider}
      initialNlpProvider={nlpProvider}
      initialNlpModel={nlpModel}
    />
  );
}
