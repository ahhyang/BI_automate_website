import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { FlowStepper } from "@/components/portal/FlowStepper";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/auth";
import { getOwnedSite } from "@/lib/owned-site";
import { getEntitlements } from "@/lib/usage";
import { databaseLabel, hostingLabel, siteUrl, storageLabel } from "@/lib/host";
import { companyDataSchema } from "@/types/content";
import type { Params } from "@/lib/page-props";

export default async function SiteOverviewPage({ params }: Params<{ siteId: string }>) {
  const session = await getSession();
  if (!session) redirect("/api/auth/guest?next=/dashboard");
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session);
  const entitlements = await getEntitlements(session.tenantId);
  const company = companyDataSchema.safeParse(site.companyData ?? {});
  const mediaCount = company.success ? company.data.media.length : 0;
  const hasContent = Boolean(site.companyData);
  const live = site.status === "live";

  if (!hasContent) {
    redirect("/create");
  }

  return (
    <div>
      <PortalNav email={session.email} isGuest={session.isGuest} />
      <FlowStepper siteId={site.id} current={live ? "publish" : "preview"} />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Site control</p>
        <h1 className="mt-3 font-display text-5xl">{site.name}</h1>
        <p className="mt-2 text-ink-soft">
          {live ? "Live" : "Draft"} · {siteUrl(site.subdomain)}
          {site.customDomain ? ` · ${site.customDomain}` : ""}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/sites/${site.id}/preview`}>Customize</ButtonLink>
          <ButtonLink href={`/sites/${site.id}/publish`} variant={live ? "ghost" : "accent"}>
            {live ? "Launch settings" : "Launch"}
          </ButtonLink>
          {live ? (
            <a
              href={siteUrl(site.subdomain)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
            >
              View live
            </a>
          ) : null}
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card title="Hosting" body={hostingLabel()} meta={live ? "Published" : "Ready to publish"} />
          <Card title="Database" body={databaseLabel()} meta="Content synced" />
          <Card
            title="Media"
            body={storageLabel()}
            meta={`${mediaCount} file${mediaCount === 1 ? "" : "s"}`}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-line bg-white p-6">
          <h2 className="font-display text-2xl">Plan</h2>
          <p className="mt-2 text-ink-soft">
            {entitlements.plan.name} · {entitlements.siteCount}/{entitlements.plan.siteLimit} sites ·{" "}
            {entitlements.canCustomDomain ? "Custom domains on" : "Subdomain only"}
          </p>
          {!entitlements.canCustomDomain ? (
            <p className="mt-3 text-sm">
              <Link href="/billing" className="underline">
                Upgrade to Pro
              </Link>{" "}
              for custom domain, analytics, and more sites.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Card({ title, body, meta }: { title: string; body: string; meta: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <p className="text-xs uppercase tracking-widest text-ink-soft">{title}</p>
      <p className="mt-2 font-display text-xl">{body}</p>
      <p className="mt-2 text-sm text-ink-soft">{meta}</p>
    </div>
  );
}
