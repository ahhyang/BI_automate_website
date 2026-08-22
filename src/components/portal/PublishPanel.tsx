"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRootDomain, siteUrl } from "@/lib/host";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorNote, Field, inputClass } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

type HostingTier = "cloud_free" | "cloud_pro";

export function PublishPanel({
  siteId,
  siteName,
  subdomain: initialSubdomain,
  customDomain,
  canCustomDomain,
  isPro,
  mediaCount,
  liveUrl,
  isGuest,
  storageName,
}: {
  siteId: string;
  siteName: string;
  subdomain: string;
  customDomain: string | null;
  canCustomDomain: boolean;
  isPro: boolean;
  mediaCount: number;
  liveUrl: string | null;
  isGuest: boolean;
  storageName: string;
}) {
  const router = useRouter();
  const root = getRootDomain();
  const pathMode = root.includes("vercel.app");
  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [url, setUrl] = useState(liveUrl || siteUrl(initialSubdomain));
  const [published, setPublished] = useState(Boolean(liveUrl));
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState(customDomain || "");
  const [dns, setDns] = useState<{ type: string; name: string; value: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [upgrade, setUpgrade] = useState<"custom_domain" | null>(null);
  const [tier, setTier] = useState<HostingTier>(isPro ? "cloud_pro" : "cloud_free");

  const previewAddress = useMemo(() => {
    if (pathMode) return `${root}/s/${subdomain || "…"}`;
    return `${subdomain || "…"}.${root}`;
  }, [pathMode, root, subdomain]);

  async function saveSubdomain() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, subdomain }),
    });
    const json = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Couldn't save that address.");
      return;
    }
    const next = siteUrl(subdomain);
    setUrl(next);
  }

  async function publish() {
    if (isGuest) {
      router.push(`/signup?next=/sites/${siteId}/publish`);
      return;
    }
    setError("");
    setBusy(true);
    await saveSubdomain();
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
    });
    const json = (await res.json()) as { url?: string; error?: string; code?: string };
    setBusy(false);
    if (res.status === 401) {
      router.push(`/signup?next=/sites/${siteId}/publish`);
      return;
    }
    if (!res.ok) {
      setError(json.error || "Publishing did not complete. Try again.");
      return;
    }
    setUrl(json.url || siteUrl(subdomain));
    setPublished(true);
  }

  async function connectDomain() {
    if (!canCustomDomain) {
      setUpgrade("custom_domain");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, domain }),
    });
    const json = (await res.json()) as {
      dns?: { type: string; name: string; value: string };
      error?: string;
    };
    setBusy(false);
    if (res.status === 402) {
      setUpgrade("custom_domain");
      return;
    }
    if (!res.ok) {
      setError(json.error || "We couldn't attach that domain.");
      return;
    }
    setDns(json.dns || null);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Launch</p>
      <h1 className="mt-3 font-display text-5xl">
        {published ? "Live — share it anywhere." : "Choose how you go live."}
      </h1>
      <p className="mt-3 text-ink-soft">
        Hosting, database, and storage are included. Pick your address, then publish.
      </p>

      {/* Hosting */}
      <section className="mt-8 rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">1. Hosting</h2>
        <p className="mt-1 text-sm text-ink-soft">Your site runs on Siteform Cloud — no separate Vercel project to manage.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTier("cloud_free")}
            className={`rounded-2xl border p-4 text-left ${tier === "cloud_free" ? "border-ink" : "border-line"}`}
          >
            <p className="text-xs uppercase tracking-widest text-ok">Included</p>
            <p className="mt-1 font-display text-xl">Cloud Free</p>
            <p className="mt-2 text-sm text-ink-soft">1 site · subdomain · Siteform badge</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setTier("cloud_pro");
              if (!isPro) router.push("/billing");
            }}
            className={`rounded-2xl border p-4 text-left ${tier === "cloud_pro" ? "border-ink" : "border-line"}`}
          >
            <p className="text-xs uppercase tracking-widest text-accent">Pro · $29/mo</p>
            <p className="mt-1 font-display text-xl">Cloud Pro</p>
            <p className="mt-2 text-sm text-ink-soft">Custom domain · analytics · 10 sites · no badge</p>
          </button>
        </div>
        <ul className="mt-4 grid gap-2 text-sm text-ink-soft sm:grid-cols-3">
          <li className="rounded-xl bg-paper px-3 py-2">Hosting · Siteform Cloud</li>
          <li className="rounded-xl bg-paper px-3 py-2">Database · Managed Postgres</li>
          <li className="rounded-xl bg-paper px-3 py-2">Media · {storageName}</li>
        </ul>
      </section>

      {/* Domain / address */}
      <section className="mt-5 rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">2. Address</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Free subdomain for every site. Custom domain on Pro.
        </p>
        <Field label="Subdomain" hint={pathMode ? `Opens at /s/your-name on ${root}` : `your-name.${root}`}>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              className={inputClass}
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-company"
            />
            <Button variant="ghost" onClick={() => void saveSubdomain()} disabled={busy}>
              Save address
            </Button>
          </div>
        </Field>
        <p className="mt-3 break-all rounded-2xl bg-paper px-4 py-3 font-mono text-sm">{previewAddress}</p>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-medium">Custom domain {canCustomDomain ? "" : "(Pro)"}</h3>
          <p className="mt-1 text-sm text-ink-soft">Point www.yourbrand.com here. Subdomain keeps working.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className={inputClass}
              placeholder="www.yourcompany.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <Button variant="ghost" onClick={() => void connectDomain()} disabled={busy || !domain.trim()}>
              Connect domain
            </Button>
          </div>
          {dns ? (
            <p className="mt-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
              Add DNS <strong>{dns.type}</strong> record: <code>{dns.name}</code> → <code>{dns.value}</code>
            </p>
          ) : null}
        </div>
      </section>

      {/* Data */}
      <section className="mt-5 rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">3. Your data</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs uppercase tracking-widest text-ink-soft">Database</p>
            <p className="mt-1 font-display text-xl">Postgres · connected</p>
            <p className="mt-2 text-sm text-ink-soft">
              Site content for <strong>{siteName}</strong> is stored in Siteform&apos;s managed database. No
              separate Neon project to create.
            </p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs uppercase tracking-widest text-ink-soft">Files</p>
            <p className="mt-1 font-display text-xl">
              {mediaCount} media file{mediaCount === 1 ? "" : "s"}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Photos, videos, and PDFs stay with this site ({storageName.toLowerCase()}).
            </p>
          </div>
        </div>
      </section>

      {published ? (
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 text-center">
          <p className="text-sm text-ink-soft">Public URL</p>
          <p className="mt-2 break-all font-display text-3xl">{url}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a
              className="inline-flex items-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open live site
            </a>
            <ButtonLink href={`/sites/${siteId}/preview`} variant="ghost">
              Keep editing
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={() => void publish()} disabled={busy}>
            {isGuest ? "Sign up to publish" : busy ? "Publishing…" : "Publish now"}
          </Button>
          <ButtonLink href={`/sites/${siteId}/preview`} variant="ghost">
            Back to editor
          </ButtonLink>
        </div>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}
      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}
