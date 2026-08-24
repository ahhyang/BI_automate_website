"use client";

import { useState } from "react";
import Link from "next/link";
import { PublishPanel } from "./PublishPanel";
import { BillingPanel } from "./BillingPanel";
import { ButtonLink } from "@/components/ui/Button";
import { databaseLabel, hostingLabel, storageLabel } from "@/lib/host";

const TABS = [
  { id: "hosting", label: "Hosting" },
  { id: "domain", label: "Domain" },
  { id: "database", label: "Database" },
  { id: "ai", label: "AI" },
  { id: "credits", label: "Credits" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectConsole({
  siteId,
  siteName,
  subdomain,
  customDomain,
  canCustomDomain,
  isPro,
  mediaCount,
  liveUrl,
  isGuest,
  storageName,
  planName,
  regenerationsUsed,
  regenerationsLimit,
  siteCount,
  siteLimit,
  stripeReady,
  planId,
  generationMode,
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
  planName: string;
  regenerationsUsed: number;
  regenerationsLimit: number;
  siteCount: number;
  siteLimit: number;
  stripeReady: boolean;
  planId: "free" | "pro";
  generationMode: string | null;
}) {
  const [tab, setTab] = useState<TabId>("hosting");

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Project</p>
      <h1 className="mt-3 font-display text-5xl">{siteName}</h1>
      <p className="mt-3 text-ink-soft">
        Hosting, domain, database, AI, and credits — configure everything here, then publish.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href={`/sites/${siteId}/preview`} variant="ghost">
          Preview
        </ButtonLink>
        <ButtonLink href={`/sites/${siteId}/develop`} variant="ghost">
          Develop
        </ButtonLink>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-ink text-paper" : "text-ink-soft hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hosting" || tab === "domain" || tab === "database" ? (
        <div className="mt-2">
          <PublishPanel
            siteId={siteId}
            siteName={siteName}
            subdomain={subdomain}
            customDomain={customDomain}
            canCustomDomain={canCustomDomain}
            isPro={isPro}
            mediaCount={mediaCount}
            liveUrl={liveUrl}
            isGuest={isGuest}
            storageName={storageName}
            focus={tab}
            embedded
          />
        </div>
      ) : null}

      {tab === "ai" ? (
        <section className="mt-6 space-y-4 rounded-3xl border border-line bg-white p-6">
          <h2 className="font-display text-2xl">AI</h2>
          <p className="text-sm text-ink-soft">
            Sites are generated with Siteform AI (OpenRouter / Claude when configured). In Develop,
            use AI chat to iterate (“shorten the hero”) or regenerate the whole site.
          </p>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="rounded-2xl bg-paper px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-ink-soft">Last mode</p>
              <p className="mt-1 font-display text-xl">
                {generationMode === "ai_custom"
                  ? "AI Custom"
                  : generationMode === "template"
                    ? "Fast Template"
                    : "—"}
              </p>
            </li>
            <li className="rounded-2xl bg-paper px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-ink-soft">Regenerations</p>
              <p className="mt-1 font-display text-xl">
                {regenerationsUsed}/{regenerationsLimit}
              </p>
            </li>
          </ul>
          <p className="text-sm text-ink-soft">
            Model is set by the operator (`OPENROUTER_MODEL`). Per-site model picker comes in a later
            phase.
          </p>
          <ButtonLink href={`/sites/${siteId}/develop`}>Open Develop</ButtonLink>
        </section>
      ) : null}

      {tab === "credits" ? (
        <section className="mt-6 space-y-4">
          <div className="rounded-3xl border border-line bg-white p-6">
            <h2 className="font-display text-2xl">Plan & credits</h2>
            <p className="mt-2 text-ink-soft">
              {planName} · {siteCount}/{siteLimit} sites · regenerations {regenerationsUsed}/
              {regenerationsLimit}
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              {hostingLabel()} · {databaseLabel()} · {storageName || storageLabel()}
            </p>
            {isGuest ? (
              <p className="mt-4 text-sm">
                <Link href={`/signup?next=/sites/${siteId}/project`} className="underline">
                  Create an account
                </Link>{" "}
                to keep this site and manage billing.
              </p>
            ) : null}
          </div>
          <BillingPanel plan={planId} stripeReady={stripeReady} compact />
        </section>
      ) : null}
    </div>
  );
}
