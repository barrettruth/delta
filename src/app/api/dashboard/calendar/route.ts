import { NextResponse } from "next/server";
import { loadDashboardCalendarData } from "@/server/dashboard-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await loadDashboardCalendarData({
    mode: searchParams.get("mode") ?? undefined,
    showDone: searchParams.get("showDone") ?? undefined,
  });

  return NextResponse.json(data);
}
