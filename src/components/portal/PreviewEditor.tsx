"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SectionKey, SiteRenderModel, TemplateId } from "@/types/content";
import { TEMPLATE_IDS } from "@/types/content";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

export function PreviewEditor({
  siteId,
  initial,
  isGuest,
}: {
  siteId: string;
  initial: SiteRenderModel;
  isGuest: boolean;
}) {
  const router = useRouter();
  const [model, setModel] = useState(initial);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [selected, setSelected] = useState<SectionKey>("hero");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"regenerations" | null>(null);
  const current = model.content[selected] as Record<string, unknown> | undefined;
  const json = useMemo(() => JSON.stringify(current ?? {}, null, 2), [current]);
  const [draft, setDraft] = useState(json);

  async function saveSection(content: Record<string, unknown>) {
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, section: { key: selected, content } }),
    });
  }

  async function applyDraft() {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      setModel((prev) => ({
        ...prev,
        content: { ...prev.content, [selected]: parsed },
      }));
      await saveSection(parsed);
      setError("");
    } catch {
      setError("That edit isn't valid. Keep it as JSON, or regenerate the section.");
    }
  }

  async function regenerate() {
    setBusy(true);
    const res = await fetch("/api/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, sectionKey: selected, content: current }),
    });
    const jsonRes = (await res.json()) as { content?: Record<string, unknown>; reason?: string; error?: string };
    setBusy(false);
    if (res.status === 402) {
      setUpgrade("regenerations");
      return;
    }
    if (!res.ok) {
      setError(jsonRes.error || "Couldn't regenerate that section. Try editing the text instead.");
      return;
    }
    if (jsonRes.content) {
      setModel((prev) => ({ ...prev, content: { ...prev.content, [selected]: jsonRes.content as never } }));
      setDraft(JSON.stringify(jsonRes.content, null, 2));
    }
  }

  async function swapTemplate(templateId: TemplateId) {
    setModel((prev) => ({ ...prev, templateId }));
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, templateId }),
    });
  }

  async function move(dir: -1 | 1) {
    const order = [...model.sectionOrder];
    const i = order.indexOf(selected);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setModel((prev) => ({ ...prev, sectionOrder: order }));
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, sectionOrder: order }),
    });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[320px_1fr]">
      <aside className="border-r border-line bg-white p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 5 · Edit</p>
        <h1 className="mt-2 font-display text-3xl">Preview</h1>
        <div className="mt-4 flex gap-2">
          <button className={`text-xs ${device === "desktop" ? "underline" : ""}`} onClick={() => setDevice("desktop")}>
            Desktop
          </button>
          <button className={`text-xs ${device === "mobile" ? "underline" : ""}`} onClick={() => setDevice("mobile")}>
            Mobile
          </button>
        </div>
        <label className="mt-4 block text-sm">
          Template
          <select
            className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            value={model.templateId}
            onChange={(e) => swapTemplate(e.target.value as TemplateId)}
          >
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm">
          Section
          <select
            className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            value={selected}
            onChange={(e) => {
              const key = e.target.value as SectionKey;
              setSelected(key);
              setDraft(JSON.stringify(model.content[key] ?? {}, null, 2));
            }}
          >
            {model.sectionOrder.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 flex gap-2 text-xs">
          <button onClick={() => move(-1)}>Move up</button>
          <button onClick={() => move(1)}>Move down</button>
        </div>
        <textarea
          className="mt-3 h-56 w-full rounded-xl border border-line p-2 font-mono text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="ghost" onClick={applyDraft}>
            Save section text
          </Button>
          <Button variant="ghost" onClick={regenerate} disabled={busy}>
            {busy ? "Rewriting…" : "Regenerate this section"}
          </Button>
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        ) : null}
        <div className="mt-6">
          <Button
            onClick={() =>
              isGuest ? router.push(`/signup?next=/sites/${siteId}/publish`) : router.push(`/sites/${siteId}/publish`)
            }
          >
            Publish
          </Button>
          {isGuest ? (
            <p className="mt-2 text-xs text-ink-soft">Create a free account to publish and keep this site.</p>
          ) : (
            <div className="mt-3">
              <ButtonLink href={`/sites/${siteId}/publish`} variant="ghost">
                Continue to publish
              </ButtonLink>
            </div>
          )}
        </div>
      </aside>
      <div className="overflow-auto bg-[#ddd2bf] p-4">
        <div className={`mx-auto overflow-hidden rounded-2xl bg-white shadow ${device === "mobile" ? "max-w-[390px]" : "max-w-5xl"}`}>
          <SiteRenderer model={model} preview />
        </div>
      </div>
      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}
