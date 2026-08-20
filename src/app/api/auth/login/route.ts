import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { setSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "Those details don't match an account." }, { status: 401 });
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.ownerUserId, user.id)).limit(1);
  if (!tenant) {
    return NextResponse.json({ error: "This account is missing a workspace. Contact support." }, { status: 500 });
  }

  await setSession({
    userId: user.id,
    tenantId: tenant.id,
    isGuest: false,
    email: user.email,
  });
  return NextResponse.json({ ok: true });
}
