"use client";

import { useState } from "react";
import { DOWNGRADE_POLICY, PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Field";

export function BillingPanel({
  plan,
  stripeReady,
}: {
  plan: "free" | "pro";
  stripeReady: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function checkout(interval: "month" | "year") {
    setPending(true);
    setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    setPending(false);
    if (!res.ok || !json.url) {
      setError(json.error || "Checkout isn't available yet.");
      return;
    }
    window.location.href = json.url;
  }

  async function portal() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      setError(json.error || "Open billing from Stripe after your first upgrade.");
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="font-display text-5xl">Plans</h1>
      <p className="mt-3 text-ink-soft">You are on {plan === "pro" ? "Pro" : "Free"}.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-line p-6">
          <h2 className="font-display text-3xl">Free</h2>
          <p className="mt-2 text-4xl">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>{PLANS.free.siteLimit} site</li>
            <li>Quick Template</li>
            <li>1 AI Custom trial</li>
            <li>Subdomain hosting</li>
            <li>{PLANS.free.regenerationsPerMonth} regenerations / month</li>
            <li>Siteform badge</li>
          </ul>
        </article>
        <article className="rounded-3xl border border-ink bg-white p-6">
          <h2 className="font-display text-3xl">Pro</h2>
          <p className="mt-2 text-4xl">
            ${PLANS.pro.monthlyPrice}
            <span className="text-lg text-ink-soft">/mo</span>
          </p>
          <p className="text-sm text-ink-soft">${PLANS.pro.annualPrice}/yr if you pay annually</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>{PLANS.pro.siteLimit} sites</li>
            <li>AI Custom</li>
            <li>Custom domain</li>
            <li>Analytics</li>
            <li>{PLANS.pro.regenerationsPerMonth} regenerations / month</li>
            <li>No badge</li>
          </ul>
          {plan === "pro" ? (
            <div className="mt-6">
              <Button onClick={portal} disabled={pending}>
                Manage subscription
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex gap-2">
              <Button onClick={() => checkout("month")} disabled={pending || !stripeReady}>
                Upgrade monthly
              </Button>
              <Button variant="ghost" onClick={() => checkout("year")} disabled={pending || !stripeReady}>
                Annual
              </Button>
            </div>
          )}
        </article>
      </div>
      {!stripeReady ? (
        <div className="mt-6">
          <ErrorNote
            message="Stripe keys aren't set, so checkout is paused."
            action="Add STRIPE_SECRET_KEY and price IDs in .env.local when you're ready to take payments."
          />
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}
      <p className="mt-8 max-w-2xl text-sm text-ink-soft">{DOWNGRADE_POLICY}</p>
    </div>
  );
}
