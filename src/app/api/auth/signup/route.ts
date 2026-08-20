import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { getSession, hashPassword, setSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const name = body.name?.trim() || null;
  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "Use a valid email and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "That email already has an account. Log in instead." },
      { status: 409 },
    );
  }

  const session = await getSession();
  const passwordHash = await hashPassword(password);

  if (session?.isGuest) {
    await db
      .update(users)
      .set({ email, passwordHash, name, isGuest: false })
      .where(eq(users.id, session.userId));
    await setSession({
      userId: session.userId,
      tenantId: session.tenantId,
      isGuest: false,
      email,
    });
    return NextResponse.json({ ok: true, convertedGuest: true });
  }

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, isGuest: false })
    .returning();
  const [tenant] = await db.insert(tenants).values({ ownerUserId: user.id }).returning();
  await setSession({
    userId: user.id,
    tenantId: tenant.id,
    isGuest: false,
    email,
  });
  return NextResponse.json({ ok: true });
}
