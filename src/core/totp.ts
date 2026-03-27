import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { users } from "@/db/schema";
import type { Db } from "./types";

const ISSUER = "delta";

export function generateTotpSecret(username: string): {
  secret: string;
  uri: string;
} {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret(),
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTotpToken(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export function enableTotp(db: Db, userId: number, secret: string): void {
  db.update(users)
    .set({ totpSecret: secret, totpEnabled: 1 })
    .where(eq(users.id, userId))
    .run();
}

export function disableTotp(db: Db, userId: number): void {
  db.update(users)
    .set({ totpSecret: null, totpEnabled: 0 })
    .where(eq(users.id, userId))
    .run();
}

export function userHasTotp(db: Db, userId: number): boolean {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return !!user?.totpEnabled;
}

export function getTotpSecret(db: Db, userId: number): string | null {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return user?.totpSecret ?? null;
}
