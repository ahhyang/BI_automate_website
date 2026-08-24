"use client";

import { useState } from "react";
import type { SiteRenderModel } from "@/types/content";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { ButtonLink } from "@/components/ui/Button";
import { siteUrl } from "@/lib/host";

export function SitePreview({
  siteId,
  model,
  live,
}: {
  siteId: string;
  model: SiteRenderModel;
  live: boolean;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Preview</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{model.company.name || model.name}</h1>
          <p className="mt-2 max-w-xl text-ink-soft">
            Review the generated site. Open Develop to edit, or Project to set hosting, domain, and
            publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/sites/${siteId}/develop`}>Open Develop</ButtonLink>
          <ButtonLink href={`/sites/${siteId}/project`} variant="accent">
            Project & publish
          </ButtonLink>
          {live ? (
            <a
              href={siteUrl(model.subdomain)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
            >
              View live
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex gap-3 text-xs">
        <button
          type="button"
          className={device === "desktop" ? "underline" : "text-ink-soft"}
          onClick={() => setDevice("desktop")}
        >
          Desktop
        </button>
        <button
          type="button"
          className={device === "mobile" ? "underline" : "text-ink-soft"}
          onClick={() => setDevice("mobile")}
        >
          Mobile
        </button>
      </div>

      <div className="mt-4 overflow-auto rounded-3xl bg-[#ddd2bf] p-4 sm:p-6">
        <div
          className={`mx-auto overflow-hidden rounded-2xl bg-white shadow ${
            device === "mobile" ? "max-w-[390px]" : "max-w-5xl"
          }`}
        >
          <SiteRenderer model={model} preview />
        </div>
      </div>
    </div>
  );
}
