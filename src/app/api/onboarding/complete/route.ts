import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/core/auth";
import { upsertIntegrationConfig } from "@/core/integration-config";
import { updateSettings } from "@/core/settings";
import type { ConflictResolution } from "@/core/types";
import { db } from "@/db";
import { users } from "@/db/schema";

interface OnboardingPayload {
  defaultView: "queue" | "kanban" | "calendar";
  defaultCategory: string;
  geoProvider?: "photon" | "mapbox" | "google_maps";
  geoApiKey?: string;
  nlpProvider?: "builtin" | "anthropic" | "openai";
  nlpApiKey?: string;
  nlpModel?: string;
  conflictResolution?: ConflictResolution;
  keymapOverrides?: Record<string, string>;
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = validateSession(db, sessionId);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as OnboardingPayload;

  updateSettings(db, user.id, {
    defaultView: body.defaultView,
    defaultCategory: body.defaultCategory || "Todo",
  });

  if (body.geoProvider && body.geoProvider !== "photon" && body.geoApiKey) {
    upsertIntegrationConfig(db, user.id, body.geoProvider, {
      api_key: body.geoApiKey,
    });
    const other = body.geoProvider === "mapbox" ? "google_maps" : "mapbox";
    try {
      const { deleteIntegrationConfig } = await import(
        "@/core/integration-config"
      );
      deleteIntegrationConfig(db, user.id, other);
    } catch {}
  }

  if (body.nlpProvider && body.nlpProvider !== "builtin" && body.nlpApiKey) {
    const provider = `nlp_${body.nlpProvider}` as const;
    upsertIntegrationConfig(
      db,
      user.id,
      provider,
      { api_key: body.nlpApiKey },
      { model: body.nlpModel },
    );
    const other =
      body.nlpProvider === "anthropic" ? "nlp_openai" : "nlp_anthropic";
    try {
      const { deleteIntegrationConfig } = await import(
        "@/core/integration-config"
      );
      deleteIntegrationConfig(db, user.id, other);
    } catch {}
  }

  if (body.conflictResolution) {
    const { getIntegrationConfig } = await import("@/core/integration-config");
    const gcalConfig = getIntegrationConfig(db, user.id, "google_calendar");
    if (gcalConfig) {
      const metadata = (gcalConfig.metadata ?? {}) as Record<string, unknown>;
      metadata.conflictResolution = body.conflictResolution;
      upsertIntegrationConfig(
        db,
        user.id,
        "google_calendar",
        gcalConfig.tokens,
        metadata,
      );
    }
  }

  if (body.keymapOverrides && Object.keys(body.keymapOverrides).length > 0) {
    db.update(users)
      .set({ keymapOverrides: JSON.stringify(body.keymapOverrides) })
      .where(eq(users.id, user.id))
      .run();
  }

  db.update(users)
    .set({ onboardingCompleted: 1 })
    .where(eq(users.id, user.id))
    .run();

  return NextResponse.json({ ok: true });
}
