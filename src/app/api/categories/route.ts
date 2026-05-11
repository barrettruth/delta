import { NextResponse } from "next/server";
import { listCategories } from "@/core/categories";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const rows = listCategories(db, user.id).map(({ name, count }) => ({
    name,
    count,
  }));

  return NextResponse.json(rows);
}
