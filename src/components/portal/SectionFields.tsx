"use client";

import type { SectionKey, SiteContentMap } from "@/types/content";
import { Field, inputClass } from "@/components/ui/Field";

type Content = SiteContentMap[SectionKey];

export function SectionFields({
  sectionKey,
  value,
  onChange,
}: {
  sectionKey: SectionKey;
  value: Content | undefined;
  onChange: (next: Content) => void;
}) {
  if (sectionKey === "hero") {
    const data = (value as SiteContentMap["hero"]) || {
      headline: "",
      subheadline: "",
      ctaLabel: "Get in touch",
      ctaHref: "#contact",
    };
    return (
      <div className="space-y-3">
        <TextField label="Headline" value={data.headline} onChange={(headline) => onChange({ ...data, headline })} />
        <TextAreaField
          label="Subheadline"
          value={data.subheadline}
          onChange={(subheadline) => onChange({ ...data, subheadline })}
        />
        <TextField label="Button label" value={data.ctaLabel} onChange={(ctaLabel) => onChange({ ...data, ctaLabel })} />
        <TextField label="Button link" value={data.ctaHref} onChange={(ctaHref) => onChange({ ...data, ctaHref })} />
      </div>
    );
  }

  if (sectionKey === "about") {
    const data = (value as SiteContentMap["about"]) || { title: "About", body: "" };
    return (
      <div className="space-y-3">
        <TextField label="Title" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        <TextAreaField label="Body" value={data.body} onChange={(body) => onChange({ ...data, body })} rows={6} />
      </div>
    );
  }

  if (sectionKey === "services" || sectionKey === "products") {
    const data = (value as SiteContentMap["services"]) || { title: "", items: [] };
    return (
      <div className="space-y-3">
        <TextField label="Title" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        {data.items.map((item, index) => (
          <div key={index} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-ink-soft">Item {index + 1}</p>
              <button
                type="button"
                className="text-xs text-ink-soft underline"
                onClick={() =>
                  onChange({
                    ...data,
                    items: data.items.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
            <TextField
              label="Title"
              value={item.title}
              onChange={(title) => {
                const items = [...data.items];
                items[index] = { ...item, title };
                onChange({ ...data, items });
              }}
            />
            <div className="mt-2">
              <TextAreaField
                label="Description"
                value={item.description}
                onChange={(description) => {
                  const items = [...data.items];
                  items[index] = { ...item, description };
                  onChange({ ...data, items });
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-sm underline"
          onClick={() =>
            onChange({
              ...data,
              items: [...data.items, { title: "New item", description: "" }],
            })
          }
        >
          Add item
        </button>
      </div>
    );
  }

  if (sectionKey === "gallery") {
    const data = (value as SiteContentMap["gallery"]) || { title: "Gallery", body: "" };
    return (
      <div className="space-y-3">
        <TextField label="Title" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        <TextAreaField label="Intro" value={data.body} onChange={(body) => onChange({ ...data, body })} />
        <p className="text-xs text-ink-soft">
          Photos, videos, and PDFs come from your uploads. Re-upload from Create to add more files.
        </p>
      </div>
    );
  }

  if (sectionKey === "testimonials") {
    const data = (value as SiteContentMap["testimonials"]) || { title: "What clients say", items: [] };
    return (
      <div className="space-y-3">
        <TextField label="Title" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        {data.items.map((item, index) => (
          <div key={index} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-ink-soft">Quote {index + 1}</p>
              <button
                type="button"
                className="text-xs text-ink-soft underline"
                onClick={() =>
                  onChange({
                    ...data,
                    items: data.items.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
            <TextAreaField
              label="Quote"
              value={item.quote}
              onChange={(quote) => {
                const items = [...data.items];
                items[index] = { ...item, quote };
                onChange({ ...data, items });
              }}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <TextField
                label="Author"
                value={item.author}
                onChange={(author) => {
                  const items = [...data.items];
                  items[index] = { ...item, author };
                  onChange({ ...data, items });
                }}
              />
              <TextField
                label="Role"
                value={item.role}
                onChange={(role) => {
                  const items = [...data.items];
                  items[index] = { ...item, role };
                  onChange({ ...data, items });
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-sm underline"
          onClick={() =>
            onChange({
              ...data,
              items: [...data.items, { quote: "A short quote", author: "", role: "" }],
            })
          }
        >
          Add quote
        </button>
      </div>
    );
  }

  if (sectionKey === "cta") {
    const data = (value as SiteContentMap["cta"]) || {
      headline: "",
      body: "",
      buttonLabel: "Contact us",
    };
    return (
      <div className="space-y-3">
        <TextField label="Headline" value={data.headline} onChange={(headline) => onChange({ ...data, headline })} />
        <TextAreaField label="Body" value={data.body} onChange={(body) => onChange({ ...data, body })} />
        <TextField
          label="Button label"
          value={data.buttonLabel}
          onChange={(buttonLabel) => onChange({ ...data, buttonLabel })}
        />
      </div>
    );
  }

  if (sectionKey === "contact") {
    const data = (value as SiteContentMap["contact"]) || {
      title: "Contact",
      body: "",
      email: "",
      phone: "",
      address: "",
      whatsapp: "",
      hours: "",
    };
    return (
      <div className="space-y-3">
        <TextField label="Title" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        <TextAreaField label="Body" value={data.body} onChange={(body) => onChange({ ...data, body })} />
        <TextField label="Email / Gmail" value={data.email} onChange={(email) => onChange({ ...data, email })} />
        <TextField label="Phone" value={data.phone} onChange={(phone) => onChange({ ...data, phone })} />
        <TextField
          label="WhatsApp"
          value={data.whatsapp}
          onChange={(whatsapp) => onChange({ ...data, whatsapp })}
        />
        <TextAreaField label="Address" value={data.address} onChange={(address) => onChange({ ...data, address })} />
        <TextField label="Hours" value={data.hours || ""} onChange={(hours) => onChange({ ...data, hours })} />
      </div>
    );
  }

  const data = (value as SiteContentMap["footer"]) || { blurb: "" };
  return (
    <div className="space-y-3">
      <TextAreaField label="Footer blurb" value={data.blurb} onChange={(blurb) => onChange({ ...data, blurb })} />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea className={inputClass} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
