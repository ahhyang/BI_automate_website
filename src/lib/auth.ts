import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { tenants, users } from "./db/schema";

export type Session = {
  userId: string;
  tenantId: string;
  isGuest: boolean;
  email: string | null;
};

const COOKIE = "sf_session";

function secret() {
  const value = process.env.AUTH_SECRET || "dev-only-change-me-before-production-use";
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function readSessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.tenantId) return null;
    return {
      userId: String(payload.userId),
      tenantId: String(payload.tenantId),
      isGuest: Boolean(payload.isGuest),
      email: payload.email ? String(payload.email) : null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(COOKIE)?.value);
}

export async function setSession(session: Session) {
  const jar = await cookies();
  const token = await signSession(session);
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function ensureGuestSession(): Promise<Session> {
  const existing = await getSession();
  if (existing) return existing;

  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ isGuest: true, name: "Guest" })
    .returning();

  const [tenant] = await db
    .insert(tenants)
    .values({ ownerUserId: user.id, plan: "free" })
    .returning();

  const session: Session = {
    userId: user.id,
    tenantId: tenant.id,
    isGuest: true,
    email: null,
  };
  await setSession(session);
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Not signed in");
  }
  return session;
}

export async function getTenantForSession(session: Session) {
  const db = getDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))
    .limit(1);
  return tenant ?? null;
}
