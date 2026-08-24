import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type {
  SiteContentMap,
  SiteRenderModel,
  SectionKey,
} from "@/types/content";
import { toLinkHref } from "@/types/content";
import { contrastText, ensureContrast } from "@/lib/color-utils";

const FONT: Record<SiteRenderModel["templateId"], { display: string; body: string }> = {
  classic: { display: "var(--font-display)", body: "var(--font-sans)" },
  modern: { display: "var(--font-sans)", body: "var(--font-sans)" },
  bold: { display: "var(--font-display)", body: "var(--font-sans)" },
  editorial: { display: "var(--font-display)", body: "var(--font-sans)" },
};

function mixPageBg(templateId: SiteRenderModel["templateId"], brand: string) {
  if (templateId === "bold") return brand;
  if (templateId === "modern") return "#F4F7F6";
  if (templateId === "editorial") return "#FBF6EE";
  return "#F7F3EC";
}

export function SiteRenderer({
  model,
  preview = false,
  selectedSection,
  onSelectSection,
}: {
  model: SiteRenderModel;
  preview?: boolean;
  selectedSection?: SectionKey | null;
  onSelectSection?: (key: SectionKey) => void;
}) {
  const brand = model.brandColor || "#1A1714";
  const pageBg = mixPageBg(model.templateId, brand);
  const ink = ensureContrast(pageBg, model.templateId === "bold" ? contrastText(brand) : "#1A1714");
  const fonts = FONT[model.templateId];
  const order = model.sectionOrder.length
    ? model.sectionOrder
    : (Object.keys(model.content) as SectionKey[]);
  const editable = Boolean(onSelectSection);

  const style = {
    "--sf-brand": brand,
    "--sf-ink": ink,
    "--sf-bg": pageBg,
    "--sf-display": fonts.display,
    "--sf-body": fonts.body,
    fontFamily: fonts.body,
    background: pageBg,
    color: ink,
  } as CSSProperties;

  return (
    <div className={`site-root template-${model.templateId} layout-${model.layoutVariant}`} style={style}>
      <Nav model={model} />
      <main>
        {order.map((key) => (
          <EditableSection
            key={key}
            sectionKey={key}
            selected={selectedSection === key}
            editable={editable}
            onSelect={onSelectSection}
          >
            <Section sectionKey={key} model={model} />
          </EditableSection>
        ))}
      </main>
      {!model.hideBadge && !preview ? (
        <Link className="powered-by" href="/">
          Built with Siteform
        </Link>
      ) : null}
    </div>
  );
}

function EditableSection({
  sectionKey,
  selected,
  editable,
  onSelect,
  children,
}: {
  sectionKey: SectionKey;
  selected: boolean;
  editable: boolean;
  onSelect?: (key: SectionKey) => void;
  children: ReactNode;
}) {
  if (!editable) return children;
  return (
    <div
      className={`sf-edit-wrap ${selected ? "is-selected" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect?.(sectionKey);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(sectionKey);
        }
      }}
    >
      <span className="sf-edit-label">{sectionKey}</span>
      {children}
    </div>
  );
}

function Nav({ model }: { model: SiteRenderModel }) {
  return (
    <header className="sf-nav">
      <div className="sf-nav-inner">
        <a href="#top" className="sf-brand">
          {model.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.logoUrl} alt={model.name} className="sf-logo" />
          ) : null}
          <span>{model.name}</span>
        </a>
        <nav>
          {model.sectionOrder.includes("gallery") ? <a href="#gallery">Gallery</a> : null}
          {model.sectionOrder.includes("services") ? <a href="#services">Services</a> : null}
          {model.sectionOrder.includes("about") ? <a href="#about">About</a> : null}
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </header>
  );
}

function Section({ sectionKey, model }: { sectionKey: SectionKey; model: SiteRenderModel }) {
  const brand = model.brandColor;
  const content = model.content;

  if (sectionKey === "hero") {
    const data = content.hero;
    if (!data) return null;
    return (
      <section className="sf-hero" id="top">
        <p className="sf-kicker">{model.company.industry || "Welcome"}</p>
        <h1>{data.headline}</h1>
        {data.subheadline ? <p className="sf-lede">{data.subheadline}</p> : null}
        <a className="sf-btn" href={data.ctaHref} style={{ background: brand, color: contrastText(brand) }}>
          {data.ctaLabel}
        </a>
      </section>
    );
  }

  if (sectionKey === "about") {
    const data = content.about;
    if (!data) return null;
    return (
      <section className="sf-section" id="about">
        <h2>{data.title}</h2>
        <div className="sf-body" style={{ whiteSpace: "pre-wrap" }}>
          {data.body}
        </div>
      </section>
    );
  }

  if (sectionKey === "services" || sectionKey === "products") {
    const data = content[sectionKey] as SiteContentMap["services"] | undefined;
    if (!data?.items?.length) return null;
    return (
      <section className="sf-section" id={sectionKey}>
        <h2>{data.title}</h2>
        <div className="sf-grid">
          {data.items.map((item) => (
            <article key={item.title} className="sf-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === "testimonials") {
    const data = content.testimonials;
    if (!data?.items?.length) return null;
    return (
      <section className="sf-section" id="testimonials">
        <h2>{data.title}</h2>
        <div className="sf-quotes">
          {data.items.map((item) => (
            <blockquote key={item.quote}>
              <p>“{item.quote}”</p>
              <footer>
                {item.author}
                {item.role ? `, ${item.role}` : ""}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === "cta") {
    const data = content.cta;
    if (!data) return null;
    return (
      <section className="sf-cta" id="cta" style={{ background: brand, color: contrastText(brand) }}>
        <h2>{data.headline}</h2>
        {data.body ? <p>{data.body}</p> : null}
        <a className="sf-btn sf-btn-invert" href="#contact">
          {data.buttonLabel}
        </a>
      </section>
    );
  }

  if (sectionKey === "gallery") {
    const data = content.gallery;
    const items = model.company.media || [];
    if (!data || !items.length) return null;
    return (
      <section className="sf-section" id="gallery">
        <h2>{data.title}</h2>
        {data.body ? <p className="sf-body">{data.body}</p> : null}
        <div className="sf-gallery">
          {items.map((item) => (
            <figure key={item.id} className="sf-gallery-item">
              {item.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption || item.filename || "Photo"} />
              ) : null}
              {item.kind === "video" ? (
                <video src={item.url} controls playsInline preload="metadata" />
              ) : null}
              {item.kind === "pdf" ? (
                <a className="sf-doc-card" href={item.url} target="_blank" rel="noreferrer">
                  <span className="sf-doc-icon">PDF</span>
                  <span>{item.caption || item.filename || "Document"}</span>
                </a>
              ) : null}
              {item.caption && item.kind !== "pdf" ? <figcaption>{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === "contact") {
    const data = content.contact;
    if (!data) return null;
    const company = model.company;
    const email = data.email || company.contact.email;
    const phone = data.phone || company.contact.phone;
    const address = data.address || company.contact.address;
    const whatsapp = data.whatsapp || company.contact.whatsapp || company.social.whatsapp;
    const website = company.contact.website;
    const socialEntries = (
      [
        ["WhatsApp", whatsapp, "whatsapp"],
        ["Email", email, "email"],
        ["Website", website, "website"],
        ["Instagram", company.social.instagram, "instagram"],
        ["Facebook", company.social.facebook, "facebook"],
        ["LinkedIn", company.social.linkedin, "linkedin"],
        ["X / Twitter", company.social.twitter, "twitter"],
        ["YouTube", company.social.youtube, "youtube"],
        ["TikTok", company.social.tiktok, "tiktok"],
        ["Telegram", company.social.telegram, "telegram"],
      ] as const
    ).filter(([, value]) => Boolean(value?.trim()));

    return (
      <section className="sf-section" id="contact">
        <h2>{data.title}</h2>
        {data.body ? <p className="sf-body">{data.body}</p> : null}
        <ul className="sf-contact">
          {email ? (
            <li>
              <a href={toLinkHref("email", email)}>{email}</a>
            </li>
          ) : null}
          {phone ? (
            <li>
              <a href={toLinkHref("phone", phone)}>{phone}</a>
            </li>
          ) : null}
          {address ? <li>{address}</li> : null}
          {data.hours || company.contact.hours ? (
            <li>Hours: {data.hours || company.contact.hours}</li>
          ) : null}
        </ul>
        {socialEntries.length ? (
          <div className="sf-social">
            {socialEntries.map(([label, value, kind]) => (
              <a
                key={label}
                className="sf-social-chip"
                href={toLinkHref(kind, value)}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (sectionKey === "footer") {
    const data = content.footer;
    if (!data) return null;
    return (
      <footer className="sf-footer">
        <p>{data.blurb}</p>
        <p>
          © {new Date().getFullYear()} {model.name}
        </p>
      </footer>
    );
  }

  return null;
}
