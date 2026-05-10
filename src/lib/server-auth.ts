import { redirect } from "next/navigation";
import type { SafeUser } from "@/core/auth";
import { getAuthUser } from "@/lib/auth-middleware";

export async function requireAuthUser(): Promise<SafeUser> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}
