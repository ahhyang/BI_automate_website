"use client";

import { ButtonLink } from "../ui/Button";

const COPY: Record<string, { title: string; body: string }> = {
  site_limit: {
    title: "Your free plan includes one site",
    body: "Upgrade to Pro to publish additional sites. Your existing site and content stay exactly as they are.",
  },
  ai_custom: {
    title: "AI Custom is a Pro feature",
    body: "You already used the free trial of AI Custom on this account. Pro unlocks unique copy, layout, and palettes whenever you need them.",
  },
  custom_domain: {
    title: "Custom domains are on Pro",
    body: "Keep your free subdomain, or connect your own domain on Pro. Nothing about the current site is lost if you stay on Free.",
  },
  regenerations: {
    title: "You're out of regenerations this month",
    body: "Free includes 3 section regenerations per month. Pro raises that to 50 so you can keep editing copy without starting over.",
  },
};

export function UpgradePrompt({
  reason,
  onClose,
}: {
  reason: keyof typeof COPY;
  onClose: () => void;
}) {
  const copy = COPY[reason];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-paper p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Upgrade when you need it</p>
        <h2 className="mt-3 font-display text-3xl">{copy.title}</h2>
        <p className="mt-3 text-ink-soft">{copy.body}</p>
        <div className="mt-6 flex gap-3">
          <ButtonLink href="/billing">See Pro — $29/mo</ButtonLink>
          <button className="text-sm text-ink-soft underline" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
