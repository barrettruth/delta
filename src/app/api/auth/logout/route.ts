import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/core/auth";
import { db } from "@/db";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (sessionId) {
    deleteSession(db, sessionId);
    cookieStore.delete("session");
  }

  return NextResponse.json({ ok: true });
}
