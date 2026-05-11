import type { SafeUser } from "@/core/auth";
import { getAuthUser } from "@/lib/auth-middleware";

export async function requireAuthUser(): Promise<SafeUser> {
  const user = await getAuthUser();
  return user;
}
