import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { appUrl } from "@/lib/host";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.isGuest) {
    return NextResponse.json({ error: "Create an account before upgrading." }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't connected yet. Add Stripe keys to enable checkout." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { interval?: "month" | "year" };
  const price =
    body.interval === "year"
      ? process.env.STRIPE_PRICE_PRO_ANNUAL
      : process.env.STRIPE_PRICE_PRO_MONTHLY;
  const stripe = getStripe()!;
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, session.tenantId)).limit(1);

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: tenant?.stripeCustomerId || undefined,
    customer_email: tenant?.stripeCustomerId ? undefined : session.email || undefined,
    line_items: [{ price: price!, quantity: 1 }],
    success_url: `${appUrl("/billing")}?upgraded=1`,
    cancel_url: appUrl("/billing"),
    metadata: { tenantId: session.tenantId },
    subscription_data: { metadata: { tenantId: session.tenantId } },
  });

  return NextResponse.json({ url: checkout.url });
}
