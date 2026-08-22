import { notFound } from "next/navigation";
import { PreviewEditor } from "@/components/portal/PreviewEditor";
import { PortalNav } from "@/components/portal/PortalNav";
import { FlowStepper } from "@/components/portal/FlowStepper";
import { getSession } from "@/lib/auth";
import { loadSiteModel } from "@/lib/sites";
import type { Params } from "@/lib/page-props";

export default async function PreviewPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) notFound();
  const { siteId } = await params;
  const model = await loadSiteModel({ siteId });
  if (!model || model.tenantId !== session.tenantId) notFound();

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <FlowStepper siteId={siteId} current="preview" />
      <PreviewEditor siteId={siteId} initial={model} isGuest={session.isGuest} />
    </div>
  );
}
