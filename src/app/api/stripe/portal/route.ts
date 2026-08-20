import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/host";

export async function POST() {
  const session = await getSession();
  if (!session || session.isGuest) {
    return NextResponse.json({ error: "Create an account first." }, { status: 401 });
  }
  const stripe = getStripe();
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, session.tenantId)).limit(1);
  if (!stripe || !tenant?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet. Upgrade first." }, { status: 400 });
  }
  const portal = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: appUrl("/billing"),
  });
  return NextResponse.json({ url: portal.url });
}
