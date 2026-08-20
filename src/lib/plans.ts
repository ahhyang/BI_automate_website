export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    siteLimit: 1,
    regenerationsPerMonth: 3,
    aiCustomEnabled: false,
    aiCustomTrial: true,
    customDomain: false,
    analytics: false,
    hideBadge: false,
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 290,
    siteLimit: 10,
    regenerationsPerMonth: 50,
    aiCustomEnabled: true,
    aiCustomTrial: false,
    customDomain: true,
    analytics: true,
    hideBadge: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlan(plan: string | null | undefined) {
  return plan === "pro" ? PLANS.pro : PLANS.free;
}

export const DOWNGRADE_POLICY =
  "If you cancel Pro, existing content is never deleted. Extra sites move to draft, custom domains disconnect, and the Siteform badge returns. You can upgrade again at any time to restore those features.";
