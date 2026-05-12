import { NextResponse } from "next/server";
import { listCategories } from "@/core/categories";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const rows = listCategories(db, user.id).map(({ name, count }) => ({
    name,
    count,
  }));

  return NextResponse.json(rows);
}
