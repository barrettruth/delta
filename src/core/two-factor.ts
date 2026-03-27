import { userHasTotp } from "./totp";
import type { Db } from "./types";
import { userHasWebAuthn } from "./webauthn";

export function userHas2FA(db: Db, userId: number): boolean {
  return userHasTotp(db, userId) || userHasWebAuthn(db, userId);
}

export type TwoFactorMethod = "totp" | "webauthn";

export function getUserTwoFactorMethods(
  db: Db,
  userId: number,
): TwoFactorMethod[] {
  const methods: TwoFactorMethod[] = [];
  if (userHasTotp(db, userId)) methods.push("totp");
  if (userHasWebAuthn(db, userId)) methods.push("webauthn");
  return methods;
}
