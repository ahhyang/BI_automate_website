import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sites, subscriptions, tenants } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function periodEnd(sub: { current_period_end?: number | null }) {
  return sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const db = getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const tenantId = session.metadata?.tenantId;
    if (tenantId && session.customer) {
      await db
        .update(tenants)
        .set({ plan: "pro", stripeCustomerId: String(session.customer) })
        .where(eq(tenants.id, tenantId));
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    const sub = event.data.object;
    const tenantId = sub.metadata?.tenantId;
    if (tenantId) {
      const active = sub.status === "active" || sub.status === "trialing";
      await db
        .update(tenants)
        .set({ plan: active ? "pro" : "free" })
        .where(eq(tenants.id, tenantId));
      await db
        .insert(subscriptions)
        .values({
          tenantId,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: periodEnd(sub as { current_period_end?: number | null }),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })
        .onConflictDoUpdate({
          target: subscriptions.tenantId,
          set: {
            stripeSubscriptionId: sub.id,
            status: sub.status,
            currentPeriodEnd: periodEnd(sub as { current_period_end?: number | null }),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const tenantId = sub.metadata?.tenantId;
    if (tenantId) {
      await db.update(tenants).set({ plan: "free" }).where(eq(tenants.id, tenantId));
      await db
        .update(subscriptions)
        .set({ status: "canceled" })
        .where(eq(subscriptions.tenantId, tenantId));
      const tenantSites = await db.select().from(sites).where(eq(sites.tenantId, tenantId));
      const extras = tenantSites.filter((site) => site.status === "live").slice(1);
      for (const site of extras) {
        await db
          .update(sites)
          .set({ status: "draft", customDomain: null, updatedAt: new Date() })
          .where(eq(sites.id, site.id));
      }
      for (const site of tenantSites) {
        if (site.customDomain) {
          await db
            .update(sites)
            .set({ customDomain: null, updatedAt: new Date() })
            .where(eq(sites.id, site.id));
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
