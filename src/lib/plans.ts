export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    // Open for testing — no paid upgrade required to try the full product.
    siteLimit: 25,
    regenerationsPerMonth: 500,
    aiCustomEnabled: true,
    aiCustomTrial: true,
    customDomain: true,
    analytics: true,
    hideBadge: true,
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 290,
    siteLimit: 50,
    regenerationsPerMonth: 1000,
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

/** When true, guests can publish and paywalls are skipped. */
export function isOpenAccess() {
  const flag = process.env.SITEFORM_OPEN_ACCESS;
  // Default ON so you can test without paying; set SITEFORM_OPEN_ACCESS=0 to enforce gates.
  if (flag === "0" || flag === "false") return false;
  return true;
}

export const DOWNGRADE_POLICY =
  "If you cancel Pro, existing content is never deleted. Extra sites move to draft, custom domains disconnect, and the Siteform badge returns. You can upgrade again at any time to restore those features.";
