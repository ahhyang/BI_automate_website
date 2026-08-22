"use client";

import Link from "next/link";

const STEPS = [
  { key: "create", label: "Upload", href: (id: string) => (id ? `/sites/${id}` : "/create") },
  { key: "preview", label: "Customize", href: (id: string) => `/sites/${id}/preview` },
  { key: "publish", label: "Launch", href: (id: string) => `/sites/${id}/publish` },
] as const;

export function FlowStepper({
  siteId,
  current,
}: {
  siteId?: string;
  current: "create" | "preview" | "publish";
}) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mx-auto flex max-w-3xl items-center gap-2 px-5 pt-6 text-xs sm:text-sm">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        const href = siteId || step.key === "create" ? step.href(siteId || "") : undefined;
        const className = `rounded-full px-3 py-1.5 ${
          active
            ? "bg-ink text-paper"
            : done
              ? "bg-white text-ink underline-offset-2 hover:underline"
              : "text-ink-soft"
        }`;
        return (
          <li key={step.key} className="flex items-center gap-2">
            {href && (done || active) ? (
              <Link href={href} className={className}>
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
