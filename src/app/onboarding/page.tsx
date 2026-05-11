import { redirect } from "next/navigation";
import { getIntegrationConfig } from "@/core/integration-config";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await requireAuthUser();
  if (user.onboardingCompleted) redirect("/");

  let geoProvider: "photon" | "mapbox" | "google_maps" = "photon";
  for (const p of ["mapbox", "google_maps"] as const) {
    const config = getIntegrationConfig(db, user.id, p);
    if (config?.enabled === 1) {
      geoProvider = p;
      break;
    }
  }

  let nlpProvider: "builtin" | "anthropic" | "openai" = "builtin";
  for (const p of ["anthropic", "openai"] as const) {
    const config = getIntegrationConfig(db, user.id, `nlp_${p}`);
    if (config?.enabled === 1) {
      nlpProvider = p;
      break;
    }
  }

  return (
    <OnboardingWizard
      initialGeoProvider={geoProvider}
      initialNlpProvider={nlpProvider}
    />
  );
}
