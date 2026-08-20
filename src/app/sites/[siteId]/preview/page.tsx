import { notFound } from "next/navigation";
import { PreviewEditor } from "@/components/portal/PreviewEditor";
import { getSession } from "@/lib/auth";
import { loadSiteModel } from "@/lib/sites";
import type { Params } from "@/lib/page-props";

export default async function PreviewPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) notFound();
  const { siteId } = await params;
  const model = await loadSiteModel({ siteId });
  if (!model || model.tenantId !== session.tenantId) notFound();

  return <PreviewEditor siteId={siteId} initial={model} isGuest={session.isGuest} />;
}
