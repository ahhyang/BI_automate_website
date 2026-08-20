import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { usageCounters, tenants, sites } from "./db/schema";
import { getPlan, type PlanId } from "./plans";

export function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getUsage(tenantId: string) {
  const db = getDb();
  const period = currentPeriod();
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.period, period)))
    .limit(1);

  return (
    row ?? {
      tenantId,
      period,
      aiGenerationsUsed: 0,
      regenerationsUsed: 0,
    }
  );
}

export async function incrementUsage(
  tenantId: string,
  field: "aiGenerationsUsed" | "regenerationsUsed",
) {
  const db = getDb();
  const period = currentPeriod();
  await db
    .insert(usageCounters)
    .values({ tenantId, period, aiGenerationsUsed: 0, regenerationsUsed: 0 })
    .onConflictDoNothing();

  const column =
    field === "aiGenerationsUsed"
      ? usageCounters.aiGenerationsUsed
      : usageCounters.regenerationsUsed;

  await db
    .update(usageCounters)
    .set({ [field]: sql`${column} + 1` })
    .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.period, period)));
}

export async function getEntitlements(tenantId: string) {
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const plan = getPlan(tenant?.plan as PlanId);
  const [siteRows] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sites)
    .where(eq(sites.tenantId, tenantId));
  const usage = await getUsage(tenantId);
  const siteCount = Number(siteRows?.count ?? 0);

  return {
    tenant,
    plan,
    siteCount,
    usage,
    canCreateSite: siteCount < plan.siteLimit,
    canUseAiCustom: plan.aiCustomEnabled || Boolean(tenant && !tenant.aiCustomTrialUsed),
    canRegenerate: usage.regenerationsUsed < plan.regenerationsPerMonth,
    canCustomDomain: plan.customDomain,
    showBadge: !plan.hideBadge,
    analytics: plan.analytics,
  };
}
