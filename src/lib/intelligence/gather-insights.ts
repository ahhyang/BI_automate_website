import type { CompanyData, SectionKey } from "@/types/content";

export const DOCUMENT_TYPES = [
  "resume",
  "personal_brand",
  "company",
  "clinic",
  "restaurant_menu",
  "brochure",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type FoundFact = {
  label: string;
  value: string;
  /** Which site section this fact will appear in */
  section: SectionKey | "brand";
};

export type InfoGap = {
  field: string;
  label: string;
  why: string;
  section: SectionKey;
  severity: "critical" | "helpful";
};

export type SectionPlan = {
  section: SectionKey;
  title: string;
  /** Where the content comes from */
  sources: string[];
  /** Whether we have enough data to populate this section */
  ready: boolean;
};

export type GatherInsights = {
  documentType: DocumentType;
  documentTypeLabel: string;
  readinessScore: number;
  summary: string;
  found: FoundFact[];
  gaps: InfoGap[];
  sectionPlan: SectionPlan[];
  /** One-line tip for the user before they create */
  tip: string;
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  resume: "Personal resume / CV",
  personal_brand: "Personal brand profile",
  company: "Company profile",
  clinic: "Clinic / healthcare",
  restaurant_menu: "Restaurant / menu",
  brochure: "Marketing brochure",
  other: "General document",
};

/** Infer document type from structured company data when LLM didn't return one. */
export function inferDocumentType(company: CompanyData): DocumentType {
  const text = `${company.name} ${company.tagline} ${company.description} ${company.industry}`.toLowerCase();
  const source = (company.sourceText || company.sourceMarkdown || "").toLowerCase();

  if (/resume|curriculum vitae|\bcv\b|work experience|professional summary|key personnel/i.test(source)) {
    return company.products.length > 0 ? "resume" : "personal_brand";
  }
  if (/clinic|medical|dental|doctor|patient|healthcare|hospital/i.test(text + source)) return "clinic";
  if (/restaurant|menu|cuisine|dish|appetizer|entree|beverage/i.test(text + source)) return "restaurant_menu";
  if (/brochure|catalog|portfolio/i.test(source)) return "brochure";
  if (company.team.length > 1 || /company|enterprise|corporation|ltd|inc\b/i.test(text)) return "company";
  if (company.products.length >= 2 && company.services.length >= 2) return "resume";
  return "company";
}

function hasContact(company: CompanyData) {
  const c = company.contact;
  return Boolean(
    c.email?.trim() ||
      c.phone?.trim() ||
      c.whatsapp?.trim() ||
      c.address?.trim() ||
      Object.values(company.social).some((v) => v?.trim()),
  );
}

function contactMethods(company: CompanyData): string[] {
  const methods: string[] = [];
  if (company.contact.email) methods.push("email");
  if (company.contact.phone) methods.push("phone");
  if (company.contact.whatsapp) methods.push("WhatsApp");
  if (company.contact.address) methods.push("address");
  const social = Object.entries(company.social).filter(([, v]) => v?.trim());
  if (social.length) methods.push(`${social.length} social link${social.length > 1 ? "s" : ""}`);
  return methods;
}

/** Map gathered facts → site sections and identify gaps. */
export function analyzeGatheredInfo(
  company: CompanyData,
  documentType?: DocumentType,
): GatherInsights {
  const docType = documentType || inferDocumentType(company);
  const found: FoundFact[] = [];
  const gaps: InfoGap[] = [];

  if (company.name?.trim() && !/^your company$/i.test(company.name.trim())) {
    found.push({ label: "Name", value: company.name, section: "hero" });
  } else {
    gaps.push({
      field: "name",
      label: "Name",
      why: "The hero headline and page title need a real name.",
      section: "hero",
      severity: "critical",
    });
  }

  if (company.tagline?.trim()) {
    found.push({ label: "Tagline", value: company.tagline, section: "hero" });
  } else if (docType !== "restaurant_menu") {
    gaps.push({
      field: "tagline",
      label: "Tagline",
      why: "A short positioning line makes the hero section compelling.",
      section: "hero",
      severity: "helpful",
    });
  }

  if (company.description?.trim().length >= 40) {
    found.push({
      label: "About",
      value: `${company.description.slice(0, 120)}${company.description.length > 120 ? "…" : ""}`,
      section: "about",
    });
  } else {
    gaps.push({
      field: "description",
      label: "About / description",
      why: "The About section needs at least a few sentences about who you are.",
      section: "about",
      severity: "critical",
    });
  }

  if (company.services.length) {
    found.push({
      label: docType === "restaurant_menu" ? "Menu items" : docType === "resume" ? "Skills & services" : "Services",
      value: `${company.services.length} item${company.services.length > 1 ? "s" : ""}: ${company.services
        .slice(0, 3)
        .map((s) => s.title)
        .join(", ")}${company.services.length > 3 ? "…" : ""}`,
      section: "services",
    });
  } else if (docType !== "resume" || company.products.length === 0) {
    gaps.push({
      field: "services",
      label: docType === "restaurant_menu" ? "Menu items" : "Services",
      why:
        docType === "restaurant_menu"
          ? "Menu items drive the main section of a restaurant site."
          : "Visitors expect to see what you offer.",
      section: "services",
      severity: docType === "restaurant_menu" ? "critical" : "helpful",
    });
  }

  if (company.products.length) {
    found.push({
      label: docType === "resume" ? "Projects / portfolio" : "Products",
      value: `${company.products.length} item${company.products.length > 1 ? "s" : ""}: ${company.products
        .slice(0, 3)
        .map((p) => p.title)
        .join(", ")}`,
      section: "products",
    });
  }

  if (company.highlights.length) {
    found.push({
      label: "Highlights",
      value: `${company.highlights.length} key point${company.highlights.length > 1 ? "s" : ""}`,
      section: "about",
    });
  }

  if (company.team.length) {
    found.push({
      label: "Team",
      value: company.team.map((m) => m.name).join(", "),
      section: "about",
    });
  }

  if (company.testimonials.length) {
    found.push({
      label: "Testimonials",
      value: `${company.testimonials.length} quote${company.testimonials.length > 1 ? "s" : ""}`,
      section: "testimonials",
    });
  }

  if (company.faqs.length) {
    found.push({
      label: "FAQs",
      value: `${company.faqs.length} question${company.faqs.length > 1 ? "s" : ""}`,
      section: "about",
    });
  }

  if (hasContact(company)) {
    found.push({
      label: "Contact",
      value: contactMethods(company).join(", "),
      section: "contact",
    });
  } else {
    gaps.push({
      field: "contact",
      label: "Contact details",
      why: "Without email, phone, or social links, visitors can't reach you.",
      section: "contact",
      severity: "critical",
    });
  }

  if (company.media.length) {
    const photos = company.media.filter((m) => m.kind === "photo").length;
    const videos = company.media.filter((m) => m.kind === "video").length;
    found.push({
      label: "Media",
      value: [photos && `${photos} photo${photos > 1 ? "s" : ""}`, videos && `${videos} video${videos > 1 ? "s" : ""}`]
        .filter(Boolean)
        .join(", "),
      section: "gallery",
    });
  }

  if (company.industry?.trim()) {
    found.push({ label: "Industry", value: company.industry, section: "brand" });
  }

  if (company.brandColor && company.brandColor !== "#1A1714") {
    found.push({ label: "Brand color", value: company.brandColor, section: "brand" });
  }

  const sectionPlan = buildSectionPlan(company, docType);
  const criticalGaps = gaps.filter((g) => g.severity === "critical").length;
  const totalChecks = found.length + gaps.length;
  const readinessScore = totalChecks
    ? Math.round(((found.length - criticalGaps * 0.5) / totalChecks) * 100)
    : 50;
  const clampedScore = Math.max(0, Math.min(100, readinessScore));

  const summary = buildSummary(company, docType, found, gaps);
  const tip = buildTip(gaps, docType);

  return {
    documentType: docType,
    documentTypeLabel: DOC_TYPE_LABELS[docType],
    readinessScore: clampedScore,
    summary,
    found,
    gaps,
    sectionPlan,
    tip,
  };
}

function buildSectionPlan(company: CompanyData, docType: DocumentType): SectionPlan[] {
  const plans: SectionPlan[] = [];

  plans.push({
    section: "hero",
    title: docType === "resume" ? "Introduction" : "Hero",
    sources: [company.tagline ? "tagline" : "", company.name ? "name" : ""].filter(Boolean),
    ready: Boolean(company.name?.trim() && (company.tagline?.trim() || company.description?.trim())),
  });

  plans.push({
    section: "about",
    title: docType === "resume" ? "Professional summary" : "About",
    sources: [
      company.description ? "description" : "",
      company.highlights.length ? "highlights" : "",
      company.team.length ? "team" : "",
      company.faqs.length ? "FAQs" : "",
    ].filter(Boolean),
    ready: company.description.trim().length >= 40,
  });

  if (company.services.length || docType === "restaurant_menu") {
    plans.push({
      section: "services",
      title:
        docType === "restaurant_menu"
          ? "Menu"
          : docType === "resume"
            ? "Skills & services"
            : docType === "clinic"
              ? "Treatments & services"
              : "Services",
      sources: company.services.length ? ["services list"] : [],
      ready: company.services.length > 0,
    });
  }

  if (company.products.length) {
    plans.push({
      section: "products",
      title: docType === "resume" ? "Projects & portfolio" : "Products",
      sources: ["products / projects"],
      ready: true,
    });
  }

  if (company.media.some((m) => m.kind === "photo" || m.kind === "video")) {
    plans.push({
      section: "gallery",
      title: "Gallery",
      sources: ["uploaded photos & videos"],
      ready: true,
    });
  }

  if (company.testimonials.length) {
    plans.push({
      section: "testimonials",
      title: "Testimonials",
      sources: ["document quotes"],
      ready: true,
    });
  }

  plans.push({
    section: "cta",
    title: "Call to action",
    sources: [company.tagline ? "tagline" : "generated from brand"],
    ready: true,
  });

  plans.push({
    section: "contact",
    title: "Contact",
    sources: contactMethods(company).length ? contactMethods(company) : [],
    ready: hasContact(company),
  });

  plans.push({
    section: "footer",
    title: "Footer",
    sources: [company.name ? "name" : "", company.services[0]?.title ? "primary offering" : ""].filter(Boolean),
    ready: Boolean(company.name?.trim()),
  });

  return plans;
}

function buildSummary(
  company: CompanyData,
  docType: DocumentType,
  found: FoundFact[],
  gaps: InfoGap[],
): string {
  const name = company.name?.trim() || "this business";
  const critical = gaps.filter((g) => g.severity === "critical");

  if (critical.length === 0 && found.length >= 4) {
    return `We read your ${DOC_TYPE_LABELS[docType].toLowerCase()} and mapped ${found.length} facts to ${new Set(found.map((f) => f.section)).size} site sections for ${name}. You're ready to build.`;
  }

  if (critical.length === 1) {
    return `We extracted solid content for ${name}, but ${critical[0].label.toLowerCase()} is still missing — it will show in the ${critical[0].section} section once you add it.`;
  }

  if (critical.length > 1) {
    return `We found useful material for ${name}, but ${critical.length} key fields need attention before the site will feel complete.`;
  }

  return `We organized your ${DOC_TYPE_LABELS[docType].toLowerCase()} into a site structure for ${name}. Review the mapping below before creating.`;
}

function buildTip(gaps: InfoGap[], docType: DocumentType): string {
  const critical = gaps.filter((g) => g.severity === "critical");
  if (critical.length === 0) return "Looks good — create the site when you're happy with the data below.";

  const first = critical[0];
  if (docType === "resume" && first.field === "contact") {
    return "Tip: Add email or LinkedIn in contact — recruiters need a way to reach you.";
  }
  if (docType === "restaurant_menu" && first.field === "services") {
    return "Tip: Paste menu items (one per line) in Services — they'll become your menu section.";
  }
  return `Tip: Fill in ${first.label.toLowerCase()} — ${first.why}`;
}

/** Document-type-aware section order for generation. */
export function smartSectionOrder(company: CompanyData, documentType?: DocumentType): SectionKey[] {
  const docType = documentType || inferDocumentType(company);
  const has = {
    services: company.services.length > 0,
    products: company.products.length > 0,
    gallery: company.media.some((m) => m.kind === "photo" || m.kind === "video"),
    testimonials: company.testimonials.length > 0,
  };

  const base: SectionKey[] = ["hero", "about"];

  if (docType === "resume" || docType === "personal_brand") {
    if (has.services) base.push("services");
    if (has.products) base.push("products");
    if (has.gallery) base.push("gallery");
    if (has.testimonials) base.push("testimonials");
  } else if (docType === "restaurant_menu") {
    if (has.services) base.push("services");
    if (has.gallery) base.push("gallery");
    if (has.testimonials) base.push("testimonials");
  } else if (docType === "clinic") {
    if (has.services) base.push("services");
    if (has.testimonials) base.push("testimonials");
    if (has.gallery) base.push("gallery");
    if (has.products) base.push("products");
  } else {
    if (has.services) base.push("services");
    if (has.products) base.push("products");
    if (has.gallery) base.push("gallery");
    if (has.testimonials) base.push("testimonials");
  }

  base.push("cta", "contact", "footer");
  return base;
}

/** Plain-text blueprint telling the generator exactly how to use each fact. */
export function buildContentBlueprint(company: CompanyData, insights: GatherInsights): string {
  const lines: string[] = [
    `Document type: ${insights.documentTypeLabel}`,
    "",
    "SECTION MAPPING (use this to place content correctly):",
  ];

  for (const plan of insights.sectionPlan) {
    const status = plan.ready ? "READY" : "NEEDS DATA";
    lines.push(`- ${plan.section.toUpperCase()} (${plan.title}) [${status}]`);
    if (plan.sources.length) lines.push(`  Sources: ${plan.sources.join(", ")}`);
  }

  lines.push("", "FACT CHECKLIST:");
  for (const fact of insights.found) {
    lines.push(`✓ ${fact.label} → ${fact.section}: ${fact.value.slice(0, 100)}`);
  }
  for (const gap of insights.gaps) {
    lines.push(`✗ MISSING ${gap.label} (for ${gap.section}) — do NOT invent; leave empty or generic`);
  }

  if (company.generationPrompt?.trim()) {
    lines.push("", "USER GENERATION PROMPT:", company.generationPrompt.trim());
  }

  return lines.join("\n").slice(0, 8000);
}
