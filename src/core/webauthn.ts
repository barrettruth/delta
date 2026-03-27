import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { webauthnCredentials } from "@/db/schema";
import type { Db } from "./types";

const RP_NAME = "delta";

function getRpId(): string {
  if (process.env.NODE_ENV === "production" && !process.env.WEBAUTHN_RP_ID) {
    throw new Error("WEBAUTHN_RP_ID must be set in production");
  }
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

function getOrigin(): string {
  if (process.env.NODE_ENV === "production" && !process.env.WEBAUTHN_ORIGIN) {
    throw new Error("WEBAUTHN_ORIGIN must be set in production");
  }
  return process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
}

export function getCredentialsForUser(db: Db, userId: number) {
  return db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .all();
}

export function userHasWebAuthn(db: Db, userId: number): boolean {
  return getCredentialsForUser(db, userId).length > 0;
}

export async function generateRegistration(
  db: Db,
  userId: number,
  username: string,
) {
  const existing = getCredentialsForUser(db, userId);
  const excludeCredentials = existing.map((c) => ({
    id: c.credentialId,
    transports: c.transports
      ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }));

  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpId(),
    userName: username,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    attestationType: "none",
  });
}

export async function verifyAndSaveRegistration(
  db: Db,
  userId: number,
  name: string,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("WebAuthn registration verification failed");
  }

  const { credential } = verification.registrationInfo;

  db.insert(webauthnCredentials)
    .values({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: response.response.transports
        ? JSON.stringify(response.response.transports)
        : null,
      name,
      createdAt: new Date().toISOString(),
    })
    .run();

  return verification;
}

export async function generateAuthentication(db: Db, userId?: number) {
  const allowCredentials = userId
    ? getCredentialsForUser(db, userId).map((c) => ({
        id: c.credentialId,
        transports: c.transports
          ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
          : undefined,
      }))
    : undefined;

  return generateAuthenticationOptions({
    rpID: getRpId(),
    allowCredentials,
    userVerification: "preferred",
  });
}

export async function verifyAndAuthenticate(
  db: Db,
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
) {
  const cred = db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, response.id))
    .get();

  if (!cred) {
    throw new Error("Unknown credential");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
    credential: {
      id: cred.credentialId,
      publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64url")),
      counter: cred.counter,
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    },
  });

  if (!verification.verified) {
    throw new Error("WebAuthn authentication verification failed");
  }

  db.update(webauthnCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentials.id, cred.id))
    .run();

  return { verified: true, userId: cred.userId };
}

export function removeCredential(db: Db, userId: number, credentialId: number) {
  const creds = getCredentialsForUser(db, userId);
  if (creds.length <= 1) {
    throw new Error("Cannot remove last credential");
  }
  db.delete(webauthnCredentials)
    .where(eq(webauthnCredentials.id, credentialId))
    .run();
}
