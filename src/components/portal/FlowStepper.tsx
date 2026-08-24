"use client";

import Link from "next/link";

const STEPS = [
  { key: "create", label: "Create", href: (_id: string) => "/create" },
  { key: "preview", label: "Preview", href: (id: string) => `/sites/${id}/preview` },
  { key: "develop", label: "Develop", href: (id: string) => `/sites/${id}/develop` },
  { key: "project", label: "Project", href: (id: string) => `/sites/${id}/project` },
] as const;

export type FlowStep = (typeof STEPS)[number]["key"];

export function FlowStepper({
  siteId,
  current,
}: {
  siteId?: string;
  current: FlowStep;
}) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-5 pt-6 text-xs sm:text-sm">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        const needsSite = step.key !== "create";
        const href = !needsSite || siteId ? step.href(siteId || "") : undefined;
        const clickable = Boolean(href) && (step.key === "create" || Boolean(siteId));
        const className = `rounded-full px-3 py-1.5 ${
          active
            ? "bg-ink text-paper"
            : done
              ? "bg-white text-ink underline-offset-2 hover:underline"
              : clickable
                ? "text-ink hover:underline"
                : "text-ink-soft"
        }`;
        return (
          <li key={step.key} className="flex items-center gap-2">
            {clickable ? (
              <Link href={href!} className={className}>
                {i + 1}. {step.label}
              </Link>
            ) : (
              <span className={className}>
                {i + 1}. {step.label}
              </span>
            )}
            {i < STEPS.length - 1 ? <span className="text-ink-soft">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
