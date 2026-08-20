import { notFound } from "next/navigation";
import { GenerateFlow } from "@/components/portal/GenerateFlow";
import { PortalNav } from "@/components/portal/PortalNav";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import { getEntitlements } from "@/lib/usage";
import { companyDataSchema } from "@/types/content";
import { emptyCompany } from "@/lib/sites";
import type { Params } from "@/lib/page-props";

export default async function GeneratePage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) notFound();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  const entitlements = await getEntitlements(session.tenantId);
  const parsed = companyDataSchema.safeParse(site.companyData ?? {});
  const company = parsed.success ? parsed.data : emptyCompany({ name: site.name });

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <GenerateFlow
        siteId={site.id}
        company={company}
        logoUrl={site.logoUrl}
        canUseAiCustom={entitlements.canUseAiCustom}
        trialAvailable={Boolean(entitlements.tenant && !entitlements.tenant.aiCustomTrialUsed && !entitlements.plan.aiCustomEnabled)}
      />
    </div>
  );
}
