import { PortalNav } from "@/components/portal/PortalNav";
import { BillingPanel } from "@/components/portal/BillingPanel";
import { getSession } from "@/lib/auth";
import { getEntitlements } from "@/lib/usage";
import { stripeConfigured } from "@/lib/stripe";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/billing");
  const entitlements = await getEntitlements(session.tenantId);
  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <BillingPanel
        plan={entitlements.plan.id}
        stripeReady={stripeConfigured() && !session.isGuest}
      />
    </div>
  );
}
