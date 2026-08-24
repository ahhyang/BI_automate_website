import { PortalNav } from "@/components/portal/PortalNav";
import { ProjectConsole } from "@/components/portal/ProjectConsole";
import { FlowStepper } from "@/components/portal/FlowStepper";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import { getEntitlements } from "@/lib/usage";
import { siteUrl, storageLabel } from "@/lib/host";
import { stripeConfigured } from "@/lib/stripe";
import { companyDataSchema } from "@/types/content";
import { notFound } from "next/navigation";
import type { Params } from "@/lib/page-props";

export default async function ProjectPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) notFound();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  const entitlements = await getEntitlements(session.tenantId);
  const company = companyDataSchema.safeParse(site.companyData ?? {});
  const mediaCount = company.success ? company.data.media.length : 0;

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <FlowStepper siteId={site.id} current="project" />
      <ProjectConsole
        siteId={site.id}
        siteName={site.name}
        subdomain={site.subdomain}
        customDomain={site.customDomain}
        canCustomDomain={entitlements.canCustomDomain}
        isPro={entitlements.plan.id === "pro"}
        mediaCount={mediaCount}
        liveUrl={site.status === "live" ? siteUrl(site.subdomain) : null}
        isGuest={session.isGuest}
        storageName={storageLabel()}
        planName={entitlements.plan.name}
        regenerationsUsed={entitlements.usage.regenerationsUsed}
        regenerationsLimit={entitlements.plan.regenerationsPerMonth}
        siteCount={entitlements.siteCount}
        siteLimit={entitlements.plan.siteLimit}
        stripeReady={stripeConfigured() && !session.isGuest}
        planId={entitlements.plan.id}
        generationMode={site.generationMode}
      />
    </div>
  );
}
