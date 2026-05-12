import type { SafeUser } from "@/core/auth";
import { getLocalOwner } from "@/lib/local-owner";

export async function requireAuthUser(): Promise<SafeUser> {
  return getLocalOwner();
}
