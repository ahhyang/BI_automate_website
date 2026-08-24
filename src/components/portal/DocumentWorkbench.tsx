"use client";

import type { CompanyData } from "@/types/content";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

export function DocumentWorkbench({
  company,
  markdown,
  plan,
  prompt,
  servicesText,
  onCompany,
  onMarkdown,
  onPlan,
  onPrompt,
  onServicesText,
  onCreate,
  onCancel,
  busy,
}: {
  company: CompanyData;
  markdown: string;
  plan: string;
  prompt: string;
  servicesText: string;
  onCompany: (next: CompanyData) => void;
  onMarkdown: (v: string) => void;
  onPlan: (v: string) => void;
  onPrompt: (v: string) => void;
  onServicesText: (v: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mt-8 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Document → plan → form</p>
        <h2 className="mt-2 font-display text-4xl">Review before we build</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          We extracted your document to Markdown, organized a site plan, and drafted the generation
          prompt. Edit anything, then create the site from this data.
        </p>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5">
        <h3 className="font-display text-2xl">1. Extracted Markdown</h3>
        <p className="mt-1 text-sm text-ink-soft">Raw content from your PDF/document. Fix OCR mistakes here.</p>
        <textarea
          className={`${inputClass} mt-3 min-h-56 font-mono text-xs leading-relaxed`}
          value={markdown}
          disabled={busy}
          onChange={(e) => onMarkdown(e.target.value)}
        />
      </section>

      <section className="rounded-3xl border border-line bg-white p-5">
        <h3 className="font-display text-2xl">2. Site plan</h3>
        <p className="mt-1 text-sm text-ink-soft">How we will organize the page from that document.</p>
        <textarea
          className={`${inputClass} mt-3 min-h-40 font-mono text-xs leading-relaxed`}
          value={plan}
          disabled={busy}
          onChange={(e) => onPlan(e.target.value)}
        />
      </section>

      <section className="rounded-3xl border border-line bg-white p-5">
        <h3 className="font-display text-2xl">3. Generation prompt</h3>
        <p className="mt-1 text-sm text-ink-soft">Instructions the AI will follow when creating the site.</p>
        <textarea
          className={`${inputClass} mt-3 min-h-36 font-mono text-xs leading-relaxed`}
          value={prompt}
          disabled={busy}
          onChange={(e) => onPrompt(e.target.value)}
        />
      </section>

      <section className="rounded-3xl border border-line bg-white p-5">
        <h3 className="font-display text-2xl">4. Structured data</h3>
        <p className="mt-1 text-sm text-ink-soft">Everything that will appear on the site. Edit freely.</p>
        <div className="mt-4 grid gap-3">
          <Field label="Company name">
            <input
              className={inputClass}
              value={company.name}
              disabled={busy}
              onChange={(e) => onCompany({ ...company, name: e.target.value })}
            />
          </Field>
          <Field label="Tagline">
            <input
              className={inputClass}
              value={company.tagline}
              disabled={busy}
              onChange={(e) => onCompany({ ...company, tagline: e.target.value })}
            />
          </Field>
          <Field label="Industry">
            <input
              className={inputClass}
              value={company.industry}
              disabled={busy}
              onChange={(e) => onCompany({ ...company, industry: e.target.value })}
            />
          </Field>
          <Field label="About / description">
            <textarea
              className={`${inputClass} min-h-28`}
              value={company.description}
              disabled={busy}
              onChange={(e) => onCompany({ ...company, description: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                className={inputClass}
                value={company.contact.email}
                disabled={busy}
                onChange={(e) =>
                  onCompany({
                    ...company,
                    contact: { ...company.contact, email: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={company.contact.phone}
                disabled={busy}
                onChange={(e) =>
                  onCompany({
                    ...company,
                    contact: { ...company.contact, phone: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="WhatsApp">
              <input
                className={inputClass}
                value={company.contact.whatsapp}
                disabled={busy}
                onChange={(e) =>
                  onCompany({
                    ...company,
                    contact: { ...company.contact, whatsapp: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Hours">
              <input
                className={inputClass}
                value={company.contact.hours || ""}
                disabled={busy}
                onChange={(e) =>
                  onCompany({
                    ...company,
                    contact: { ...company.contact, hours: e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <Field label="Address">
            <textarea
              className={`${inputClass} min-h-16`}
              value={company.contact.address}
              disabled={busy}
              onChange={(e) =>
                onCompany({
                  ...company,
                  contact: { ...company.contact, address: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Services / skills (one per line — optional price after | )">
            <textarea
              className={`${inputClass} min-h-32`}
              value={servicesText}
              disabled={busy}
              onChange={(e) => onServicesText(e.target.value)}
              placeholder={"Full-Stack Web Development\nFlutter Mobile Apps\nAI / LLM Integration"}
            />
          </Field>
          <Field label="Projects / products (one per line) — edit in About if needed">
            <textarea
              className={`${inputClass} min-h-24`}
              value={company.products.map((p) => (p.price ? `${p.title} | ${p.price}` : p.title)).join("\n")}
              disabled={busy}
              onChange={(e) =>
                onCompany({
                  ...company,
                  products: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [title, price] = line.split("|").map((p) => p.trim());
                      const prev = company.products.find((p) => p.title === title);
                      return { title, description: prev?.description || "", price: price || prev?.price || "" };
                    }),
                })
              }
              placeholder={"AI Health Assistant\nAI Food Scanner\nAI Recipe Generator"}
            />
          </Field>
          <Field label="Highlights (one per line)">
            <textarea
              className={`${inputClass} min-h-20`}
              value={company.highlights.join("\n")}
              disabled={busy}
              onChange={(e) =>
                onCompany({
                  ...company,
                  highlights: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pb-8">
        <Button onClick={onCreate} disabled={busy || !company.name.trim()}>
          {busy ? "Creating site…" : "Create site from this data"}
        </Button>
        <button type="button" className="text-sm underline" onClick={onCancel} disabled={busy}>
          Start over
        </button>
      </div>
    </div>
  );
}
