import { notFound } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { PublishPanel } from "@/components/portal/PublishPanel";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import { getEntitlements } from "@/lib/usage";
import { siteUrl } from "@/lib/host";
import type { Params } from "@/lib/page-props";

export default async function PublishPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) notFound();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  const entitlements = await getEntitlements(session.tenantId);

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <PublishPanel
        siteId={site.id}
        subdomain={site.subdomain}
        customDomain={site.customDomain}
        canCustomDomain={entitlements.canCustomDomain}
        liveUrl={site.status === "live" ? siteUrl(site.subdomain) : null}
      />
    </div>
  );
}
