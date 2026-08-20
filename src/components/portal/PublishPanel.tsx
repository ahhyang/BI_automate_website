"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { siteUrl } from "@/lib/host";
import { Button } from "@/components/ui/Button";
import { ErrorNote, inputClass } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

export function PublishPanel({
  siteId,
  subdomain,
  customDomain,
  canCustomDomain,
  liveUrl,
}: {
  siteId: string;
  subdomain: string;
  customDomain: string | null;
  canCustomDomain: boolean;
  liveUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(liveUrl || siteUrl(subdomain));
  const [published, setPublished] = useState(Boolean(liveUrl));
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState(customDomain || "");
  const [dns, setDns] = useState<{ type: string; name: string; value: string } | null>(null);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"custom_domain" | null>(null);

  async function publish() {
    setError("");
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
    });
    const json = (await res.json()) as { url?: string; error?: string; code?: string };
    if (res.status === 401) {
      router.push(`/signup?next=/sites/${siteId}/publish`);
      return;
    }
    if (!res.ok) {
      setError(json.error || "Publishing did not complete. Try again.");
      return;
    }
    setUrl(json.url || url);
    setPublished(true);
  }

  async function connectDomain() {
    if (!canCustomDomain) {
      setUpgrade("custom_domain");
      return;
    }
    const res = await fetch("/api/domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, domain }),
    });
    const json = (await res.json()) as {
      dns?: { type: string; name: string; value: string };
      error?: string;
      reason?: string;
    };
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
    <div className="mx-auto max-w-2xl px-5 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 6 · Publish</p>
      <h1 className="mt-3 font-display text-5xl">
        {published ? "It's live." : "One button. Then it's on the internet."}
      </h1>

      {published ? (
        <div className="mt-8 rounded-3xl border border-line bg-white p-6">
          <p className="text-sm text-ink-soft">Your site</p>
          <p className="mt-2 break-all font-display text-3xl">{url}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a
              className="inline-flex items-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Share / open
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <Button onClick={publish}>Publish</Button>
          <p className="mt-3 text-sm text-ink-soft">It will go live at {siteUrl(subdomain)}</p>
        </div>
      )}

      <div className="mt-12 rounded-3xl border border-line p-6 text-left">
        <h2 className="font-display text-2xl">Connect a custom domain</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Optional, and a Pro feature. Your subdomain keeps working either way.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            className={inputClass}
            placeholder="www.yourcompany.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Button variant="ghost" onClick={connectDomain}>
            Connect
          </Button>
        </div>
        {dns ? (
          <p className="mt-3 text-sm">
            Add a {dns.type} record: {dns.name} → {dns.value}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 text-left">
          <ErrorNote message={error} />
        </div>
      ) : null}
      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}
