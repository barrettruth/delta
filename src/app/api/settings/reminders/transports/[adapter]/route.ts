import { NextResponse } from "next/server";
import {
  deleteReminderTransportConfig,
  getReminderTransportConfigStatus,
  setReminderTransportConfig,
} from "@/core/reminders/transport-config";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import {
  isReminderTransportConfigurableAdapterKey,
  normalizeReminderTransportConfigValues,
} from "@/lib/reminder-transport-form";

type Params = { params: Promise<{ adapter: string }> };

async function getAdapterKey(params: Params["params"]) {
  const { adapter } = await params;
  return isReminderTransportConfigurableAdapterKey(adapter) ? adapter : null;
}

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const adapterKey = await getAdapterKey(params);
  if (!adapterKey) {
    return NextResponse.json(
      { error: "Invalid reminder transport" },
      { status: 400 },
    );
  }

  return NextResponse.json(getReminderTransportConfigStatus(db, adapterKey));
}

export async function PUT(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const adapterKey = await getAdapterKey(params);
  if (!adapterKey) {
    return NextResponse.json(
      { error: "Invalid reminder transport" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    values?: unknown;
  } | null;
  const parsed = normalizeReminderTransportConfigValues(
    adapterKey,
    body?.values,
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  return NextResponse.json(
    setReminderTransportConfig(db, adapterKey, parsed.values),
  );
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const adapterKey = await getAdapterKey(params);
  if (!adapterKey) {
    return NextResponse.json(
      { error: "Invalid reminder transport" },
      { status: 400 },
    );
  }

  const result = deleteReminderTransportConfig(db, adapterKey);
  if (!result.deleted) {
    return NextResponse.json(
      { error: "Transport config not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(result.status);
}
