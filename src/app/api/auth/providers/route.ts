import { NextResponse } from "next/server";
import { getEnabledProviders } from "@/core/oauth";
import { db } from "@/db";

export async function GET() {
  return NextResponse.json({ providers: getEnabledProviders(db) });
}
