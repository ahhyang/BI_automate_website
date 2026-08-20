import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { getDemoSite } from "@/lib/demo-sites";
import { loadSiteModel } from "@/lib/sites";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import type { Params, Search } from "@/lib/page-props";
import { firstParam } from "@/lib/page-props";

export default async function TenantSitePage({
  params,
  searchParams,
}: Params<{ subdomain: string }> & Search) {
  const { subdomain } = await params;
  const query = await searchParams;
  const preview = firstParam(query.preview) === "1";
  const headerStore = await headers();

  if (subdomain === "_custom") {
    const domain = headerStore.get("x-siteform-custom-domain");
    if (!domain) notFound();
    const model = await loadSiteByCatch(async () => loadSiteModel({ customDomain: domain }));
    return renderPublic(model, preview);
  }

  const demo = getDemoSite(subdomain);
  if (demo) return <SiteRenderer model={demo} />;

  const model = await loadSiteByCatch(async () => loadSiteModel({ subdomain }));
  return renderPublic(model, preview);
}

async function loadSiteByCatch(
  fn: () => ReturnType<typeof loadSiteModel>,
) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function renderPublic(
  model: Awaited<ReturnType<typeof loadSiteModel>>,
  preview: boolean,
) {
  if (!model) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-display text-4xl">This site isn’t live yet.</p>
          <p className="mt-3 text-ink-soft">If you own it, publish it from your Siteform dashboard.</p>
        </div>
      </div>
    );
  }

  const session = await getSession();
  const isOwner = session?.tenantId === model.tenantId;
  if (model.status !== "live" && !isOwner && !preview) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-display text-4xl">Draft — not published yet.</p>
          <p className="mt-3 text-ink-soft">The owner still needs to hit Publish.</p>
        </div>
      </div>
    );
  }

  if (model.status === "live") {
    try {
      const db = getDb();
      await db.update(sites).set({ visits: sql`${sites.visits} + 1` }).where(eq(sites.id, model.siteId));
    } catch {
      /* visits are best-effort */
    }
  }

  return <SiteRenderer model={model} />;
}
