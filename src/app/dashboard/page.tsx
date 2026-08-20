import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generationJobs, sites } from "@/lib/db/schema";
import { getEntitlements } from "@/lib/usage";
import { siteUrl } from "@/lib/host";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/guest?next=/dashboard");
  const entitlements = await getEntitlements(session.tenantId);
  const db = getDb();
  const siteRows = await db
    .select()
    .from(sites)
    .where(eq(sites.tenantId, session.tenantId))
    .orderBy(desc(sites.updatedAt));
  const jobs = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.tenantId, session.tenantId))
    .orderBy(desc(generationJobs.updatedAt));

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl">Your sites</h1>
            <p className="mt-2 text-ink-soft">
              {entitlements.siteCount}/{entitlements.plan.siteLimit} {entitlements.plan.name.toLowerCase()} sites used
              · AI regenerations {entitlements.usage.regenerationsUsed}/{entitlements.plan.regenerationsPerMonth} this month
            </p>
          </div>
          <ButtonLink href="/create">New site</ButtonLink>
        </div>

        {jobs.some((job) => job.status === "running") ? (
          <p className="mt-6 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            A generation is still running. You can leave — we will mark it ready here when it finishes.
          </p>
        ) : null}

        <div className="mt-8 grid gap-4">
          {siteRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-10 text-center">
              <p className="font-display text-3xl">Nothing here yet</p>
              <p className="mt-2 text-ink-soft">Upload a logo and a doc to get a preview in minutes.</p>
            </div>
          ) : (
            siteRows.map((site) => (
              <article key={site.id} className="rounded-3xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-ink-soft">{site.status}</p>
                    <h2 className="font-display text-3xl">{site.name}</h2>
                    <p className="mt-1 text-sm text-ink-soft">{siteUrl(site.subdomain)}</p>
                    {entitlements.analytics ? (
                      <p className="mt-1 text-sm">{site.visits} visits</p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-soft">Visit counts unlock on Pro</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <ButtonLink href={`/sites/${site.id}/preview`} variant="ghost">
                      Edit
                    </ButtonLink>
                    {site.status === "live" ? (
                      <ButtonLink href={siteUrl(site.subdomain)} variant="primary">
                        View live
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={`/sites/${site.id}/publish`} variant="primary">
                        Publish
                      </ButtonLink>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
