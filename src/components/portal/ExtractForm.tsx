"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanyData } from "@/types/content";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

export function ExtractForm({ siteId, initial }: { siteId: string; initial: CompanyData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const uncertain = new Set(data.uncertainFields);

  function set<K extends keyof CompanyData>(key: K, value: CompanyData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setPending(true);
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, company: data }),
    });
    setPending(false);
    router.push(`/sites/${siteId}/generate`);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 2 · Review</p>
      <h1 className="mt-3 font-display text-5xl">Check this before we build the site.</h1>
      <p className="mt-3 text-ink-soft">
        Parsing misses things. Fix them here — far cheaper than finding a wrong phone number after
        you publish.
      </p>

      <div className="mt-8 space-y-4 rounded-3xl border border-line bg-white p-6">
        <Field label="Company name" uncertain={uncertain.has("name")}>
          <input className={inputClass} value={data.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Tagline" uncertain={uncertain.has("tagline")}>
          <input className={inputClass} value={data.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field label="Industry" uncertain={uncertain.has("industry") || !data.industry}>
          <input className={inputClass} value={data.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Leave blank if you're not sure" />
        </Field>
        <Field label="One-line description" uncertain={uncertain.has("description")}>
          <textarea className={`${inputClass} min-h-24`} value={data.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Services (one per line: title — description)" uncertain={uncertain.has("services")}>
          <textarea
            className={`${inputClass} min-h-28`}
            value={data.services.map((s) => `${s.title}${s.description ? ` — ${s.description}` : ""}`).join("\n")}
            onChange={(e) =>
              set(
                "services",
                e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [title, ...rest] = line.split("—");
                    return { title: title.trim(), description: rest.join("—").trim() };
                  }),
              )
            }
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Email" uncertain={uncertain.has("contact.email") || !data.contact.email}>
            <input
              className={inputClass}
              value={data.contact.email}
              onChange={(e) => set("contact", { ...data.contact, email: e.target.value })}
            />
          </Field>
          <Field label="Phone" uncertain={uncertain.has("contact.phone") || !data.contact.phone}>
            <input
              className={inputClass}
              value={data.contact.phone}
              onChange={(e) => set("contact", { ...data.contact, phone: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Address" uncertain={uncertain.has("contact.address")}>
          <input
            className={inputClass}
            value={data.contact.address}
            onChange={(e) => set("contact", { ...data.contact, address: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Brand color (from logo)">
            <input
              type="color"
              value={data.brandColor}
              onChange={(e) => set("brandColor", e.target.value)}
            />
          </Field>
          <Field label="Tone of voice">
            <select
              className={inputClass}
              value={data.tone}
              onChange={(e) => set("tone", e.target.value as CompanyData["tone"])}
            >
              <option value="formal">Formal</option>
              <option value="friendly">Friendly</option>
              <option value="technical">Technical</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <Button onClick={save} disabled={pending || !data.name}>
          {pending ? "Saving…" : "Looks good — choose a mode"}
        </Button>
      </div>
    </div>
  );
}
