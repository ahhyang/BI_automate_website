"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanyData, TemplateId } from "@/types/content";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

const TEMPLATES: { id: TemplateId; name: string; note: string }[] = [
  { id: "classic", name: "Classic", note: "Serif, measured, professional" },
  { id: "modern", name: "Modern", note: "Clean type, lots of air" },
  { id: "bold", name: "Bold", note: "Brand color as the page" },
  { id: "editorial", name: "Editorial", note: "Magazine, warm paper" },
  { id: "glass", name: "Glass", note: "Glassmorphism + glow" },
  { id: "aurora", name: "Aurora", note: "Animated gradient sky" },
  { id: "noir", name: "Noir", note: "Dark, sharp contrast" },
  { id: "meadow", name: "Meadow", note: "Fresh green calm" },
];

const DEFAULT_STEPS = [
  { key: "copy", label: "Writing homepage copy", status: "pending" },
  { key: "structure", label: "Building page structure", status: "pending" },
  { key: "colors", label: "Applying brand colors", status: "pending" },
  { key: "provision", label: "Provisioning your site", status: "pending" },
  { key: "ready", label: "Preview ready", status: "pending" },
];

export function GenerateFlow({
  siteId,
  company,
  canUseAiCustom,
  trialAvailable,
  logoUrl,
}: {
  siteId: string;
  company: CompanyData;
  canUseAiCustom: boolean;
  trialAvailable: boolean;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"template" | "ai_custom" | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"ai_custom" | null>(null);
  const [awayHint, setAwayHint] = useState(false);

  async function generate() {
    if (mode === "ai_custom" && !canUseAiCustom) {
      setUpgrade("ai_custom");
      return;
    }
    setError("");
    setRunning(true);
    setAwayHint(true);
    setSteps(DEFAULT_STEPS.map((step, i) => ({ ...step, status: i === 0 ? "running" : "pending" })));
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, mode, templateId }),
    });
    if (res.status === 402) {
      setRunning(false);
      setUpgrade("ai_custom");
      return;
    }
    if (!res.body) {
      setRunning(false);
      setError("Generation didn't start. Try Quick Template.");
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const event = chunk.match(/^event: (.+)$/m)?.[1];
        const dataLine = chunk.match(/^data: (.+)$/m)?.[1];
        if (!event || !dataLine) continue;
        const data = JSON.parse(dataLine) as {
          message?: string;
          siteId?: string;
        };
        if (event === "steps") {
          setSteps(JSON.parse(dataLine));
        }
        if (event === "error") {
          setError(data.message || "Generation didn't finish. Try Quick Template.");
          setRunning(false);
        }
        if (event === "done") {
          router.push(`/sites/${siteId}/preview`);
        }
      }
    }
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 3 · Mode</p>
      <h1 className="mt-3 font-display text-5xl">How should we build it?</h1>
      <p className="mt-3 text-ink-soft">Honest tradeoffs. Not an upsell maze.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("template")}
          className={`rounded-3xl border p-6 text-left ${mode === "template" ? "border-ink bg-white" : "border-line"}`}
        >
          <p className="text-xs uppercase tracking-widest text-ok">Free</p>
          <h2 className="mt-2 font-display text-3xl">Quick Template</h2>
          <p className="mt-2 text-ink-soft">Live in ~30 seconds. Clean, professional, pick from a few layouts.</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("ai_custom")}
          className={`rounded-3xl border p-6 text-left ${mode === "ai_custom" ? "border-ink bg-white" : "border-line"}`}
        >
          <p className="text-xs uppercase tracking-widest text-accent">
            {trialAvailable ? "Free trial · once" : "Pro"}
          </p>
          <h2 className="mt-2 font-display text-3xl">AI Custom</h2>
          <p className="mt-2 text-ink-soft">
            ~2–3 minutes. Unique copywriting, layout, and color palette tailored to {company.name || "your business"}.
          </p>
        </button>
      </div>

      {mode === "template" ? (
        <div className="mt-8">
          <h3 className="font-display text-2xl">Templates with your brand</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplateId(tpl.id)}
                className={`overflow-hidden rounded-2xl border text-left ${templateId === tpl.id ? "border-ink" : "border-line"}`}
              >
                <div
                  className="h-28 p-3"
                  style={{
                    background: tpl.id === "bold" ? company.brandColor : "#fff",
                    color: tpl.id === "bold" ? "#f7f3ec" : "#1a1714",
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="mb-2 h-8 w-8 rounded-full object-contain bg-white" />
                  ) : (
                    <div className="mb-2 h-2 w-16 rounded-full" style={{ background: company.brandColor }} />
                  )}
                  <p className="text-sm font-semibold">{company.name || "Your company"}</p>
                  <p className="text-xs opacity-70">{company.tagline.slice(0, 48)}</p>
                </div>
                <div className="p-3">
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-xs text-ink-soft">{tpl.note}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {running || awayHint ? (
        <ol className="mt-8 space-y-2 rounded-3xl border border-line bg-white p-5 text-sm">
          {steps.map((step) => (
            <li key={step.key} className="flex gap-2">
              <span>{step.status === "done" ? "✓" : step.status === "running" ? "●" : "○"}</span>
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}

      {awayHint && running ? (
        <p className="mt-3 text-sm text-ink-soft">
          You can leave this page. We will mark the site ready on your dashboard
          {company.contact.email ? " and email you" : ""}.
        </p>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-8">
        <Button onClick={generate} disabled={!mode || running}>
          {running ? "Generating…" : "Generate preview"}
        </Button>
      </div>
      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}
