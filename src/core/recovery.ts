import { randomBytes } from "node:crypto";
import { hashSync, compareSync } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { recoveryCodes } from "@/db/schema";
import type { Db } from "./types";

const CODE_COUNT = 8;
const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  const bytes = randomBytes(4);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function generateRecoveryCodes(db: Db, userId: number): string[] {
  db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId)).run();

  const codes: string[] = [];
  for (let i = 0; i < CODE_COUNT; i++) {
    const code = generateCode();
    codes.push(code);
    db.insert(recoveryCodes)
      .values({
        userId,
        codeHash: hashSync(code, BCRYPT_ROUNDS),
        used: 0,
      })
      .run();
  }

  return codes;
}

export function verifyRecoveryCode(
  db: Db,
  userId: number,
  code: string,
): boolean {
  const rows = db
    .select()
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.used, 0)))
    .all();

  for (const row of rows) {
    if (compareSync(code, row.codeHash)) {
      db.update(recoveryCodes)
        .set({ used: 1 })
        .where(eq(recoveryCodes.id, row.id))
        .run();
      return true;
    }
  }

  return false;
}

export function hasRecoveryCodes(db: Db, userId: number): boolean {
  const unused = db
    .select()
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.used, 0)))
    .all();
  return unused.length > 0;
}

export function remainingRecoveryCodeCount(db: Db, userId: number): number {
  return db
    .select()
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.used, 0)))
    .all().length;
}
