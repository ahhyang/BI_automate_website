import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import type { Params } from "@/lib/page-props";

/** Site overview → Project console. */
export default async function SiteOverviewRedirect({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) redirect("/api/auth/guest?next=/dashboard");
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  if (!site.companyData) redirect("/create");
  redirect(`/sites/${site.id}/project`);
}
