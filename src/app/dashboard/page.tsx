import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generationJobs, sites } from "@/lib/db/schema";
import { getEntitlements } from "@/lib/usage";
import { hostingLabel, siteUrl } from "@/lib/host";

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
              {entitlements.siteCount}/{entitlements.plan.siteLimit} {entitlements.plan.name.toLowerCase()} sites
              · {hostingLabel()} · regenerations {entitlements.usage.regenerationsUsed}/
              {entitlements.plan.regenerationsPerMonth}
            </p>
          </div>
          <ButtonLink href="/create">New site</ButtonLink>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Hosting" value="Included" note="Siteform Cloud" />
          <Stat label="Database" value="Postgres" note="Managed · included" />
          <Stat
            label="Domains"
            value={entitlements.canCustomDomain ? "Custom OK" : "Subdomain"}
            note={entitlements.canCustomDomain ? "Pro active" : "Upgrade for custom"}
          />
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
              <p className="mt-2 text-ink-soft">Drop a PDF, photos, or links to generate your first site.</p>
              <div className="mt-5">
                <ButtonLink href="/create">Start creating</ButtonLink>
              </div>
            </div>
          ) : (
            siteRows.map((site) => {
              const live = site.status === "live";
              const url = siteUrl(site.subdomain);
              return (
                <article key={site.id} className="rounded-3xl border border-line bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            live ? "bg-ok/15 text-ok" : "bg-line/60 text-ink-soft"
                          }`}
                        >
                          {live ? "Live" : "Draft"}
                        </span>
                        {site.customDomain ? (
                          <span className="rounded-full bg-paper px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">
                            Custom domain
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 font-display text-3xl">{site.name}</h2>
                      <p className="mt-1 break-all text-sm text-ink-soft">{url}</p>
                      {entitlements.analytics ? (
                        <p className="mt-1 text-sm">{site.visits} visits</p>
                      ) : (
                        <p className="mt-1 text-sm text-ink-soft">Visit counts unlock on Pro</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={`/sites/${site.id}`} variant="ghost">
                        Overview
                      </ButtonLink>
                      <ButtonLink href={`/sites/${site.id}/preview`} variant="ghost">
                        Edit
                      </ButtonLink>
                      {live ? (
                        <ButtonLink href={url} variant="primary">
                          View live
                        </ButtonLink>
                      ) : (
                        <ButtonLink href={`/sites/${site.id}/publish`} variant="primary">
                          Launch
                        </ButtonLink>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
      <p className="text-xs text-ink-soft">{note}</p>
    </div>
  );
}
