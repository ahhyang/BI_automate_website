import Link from "next/link";
import { DEMO_SITES } from "@/lib/demo-sites";
import { getSession } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/Button";

const EXAMPLES = Object.values(DEMO_SITES);

export default async function HomePage() {
  const session = await getSession();

  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-display text-2xl">Siteform</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="#examples" className="hidden sm:inline hover:underline">
            Examples
          </Link>
          <Link href="/billing" className="hidden sm:inline hover:underline">
            Pricing
          </Link>
          {session && !session.isGuest ? (
            <ButtonLink href="/dashboard" variant="ghost">
              Dashboard
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="ghost">
              Log in
            </ButtonLink>
          )}
          <ButtonLink href="/create">Start for free</ButtonLink>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-10 pt-16 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">No credit card for the free plan</p>
        <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl">
          Drop a PDF. Get a live website.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft">
          We generate the whole site, then you drag sections and edit the copy. Publish when it looks right.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/create" variant="accent">
            Start for free
          </ButtonLink>
          <ButtonLink href="#examples" variant="ghost">
            See real examples
          </ButtonLink>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          You can preview before creating an account. Sign up only when you want to publish.
        </p>
      </section>

      <section id="examples" className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl">Three real generated sites</h2>
            <p className="mt-2 text-ink-soft">
              Same engine your company will use — not mockups. Click through.
            </p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {EXAMPLES.map((site) => (
            <Link
              key={site.subdomain}
              href={`/examples/${site.subdomain}`}
              className="group overflow-hidden rounded-3xl border border-line bg-white shadow-sm"
            >
              <div className="relative h-64 overflow-hidden bg-[#efe6d6]">
                <iframe
                  title={site.name}
                  src={`/examples/${site.subdomain}`}
                  className="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50"
                  tabIndex={-1}
                />
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                  {site.company.industry}
                </p>
                <h3 className="mt-1 font-display text-2xl group-hover:underline">{site.name}</h3>
                <p className="mt-2 text-sm text-ink-soft">{site.company.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-3">
        {[
          ["1. Drop a PDF", "Company write-up or Word doc. Logo is optional. Generation starts as soon as you drop the file."],
          ["2. Customize", "Drag sections to reorder. Click any block to edit headlines, services, and contact details."],
          ["3. Publish", "Live on a subdomain immediately. Custom domain is a Pro add-on, not a requirement."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-3xl border border-line p-6">
            <h3 className="font-display text-2xl">{title}</h3>
            <p className="mt-3 text-ink-soft">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line px-5 py-10 text-center text-sm text-ink-soft">
        Siteform · One app, one database, every customer site on a subdomain.
      </footer>
    </div>
  );
}
