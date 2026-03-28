import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserTwoFactorMethods } from "@/core/two-factor";
import { db } from "@/db";
import { Verify2FA } from "./verify-2fa";

export default async function Verify2FAPage() {
  const cookieStore = await cookies();
  const pendingUserId = cookieStore.get("pending_2fa")?.value;

  if (!pendingUserId) redirect("/login");

  const userId = Number.parseInt(pendingUserId, 10);
  const methods = getUserTwoFactorMethods(db, userId);

  if (methods.length === 0) redirect("/login");

  return <Verify2FA methods={methods} />;
}
