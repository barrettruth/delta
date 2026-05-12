import type { SafeUser } from "@/core/auth";
import { getOrCreateLocalUser } from "@/core/auth";
import { db } from "@/db";

export function getLocalOwner(): SafeUser {
  return getOrCreateLocalUser(db);
}
