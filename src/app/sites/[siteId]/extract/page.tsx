import { notFound } from "next/navigation";
import { ExtractForm } from "@/components/portal/ExtractForm";
import { PortalNav } from "@/components/portal/PortalNav";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import { companyDataSchema } from "@/types/content";
import { emptyCompany } from "@/lib/sites";
import type { Params } from "@/lib/page-props";

export default async function ExtractPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) notFound();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  const parsed = companyDataSchema.safeParse(site.companyData ?? {});
  const company = parsed.success ? parsed.data : emptyCompany({ name: site.name });

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <ExtractForm siteId={site.id} initial={company} />
    </div>
  );
}
