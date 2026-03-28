import { NextResponse } from "next/server";
import { getEnabledProviders } from "@/core/oauth";

export async function GET() {
  return NextResponse.json({ providers: getEnabledProviders() });
}
