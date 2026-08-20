import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import type { Params } from "@/lib/page-props";

export default async function SiteIndexPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  if (site.status === "live" || site.companyData) {
    redirect(`/sites/${siteId}/preview`);
  }
  notFound();
}
