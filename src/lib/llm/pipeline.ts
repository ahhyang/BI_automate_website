import Anthropic from "@anthropic-ai/sdk";
import {
  companyDataSchema,
  sectionSchemas,
  type CompanyData,
  type FiveQuestions,
  type SiteContentMap,
  type TemplateId,
  type LayoutVariant,
  type SectionKey,
  SECTION_KEYS,
} from "@/types/content";

/** OpenRouter model id, or Anthropic native id when using ANTHROPIC_API_KEY only. */
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function client(): { anthropic: Anthropic; model: string } | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      anthropic: new Anthropic({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://siteform-omega.vercel.app",
          "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Siteform",
        },
      }),
      model: OPENROUTER_MODEL,
    };
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      anthropic: new Anthropic({ apiKey: anthropicKey }),
      model: ANTHROPIC_MODEL,
    };
  }
  return null;
}

async function completeJson(system: string, user: string, maxTokens = 4096) {
  const wired = client();
  if (!wired) return null;
  try {
    const message = await wired.anthropic.messages.create({
      model: wired.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

function guessEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function guessPhone(text: string) {
  return text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? "";
}

function firstLines(text: string, n = 8) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, n);
}

const CRITICAL_UNCERTAIN = new Set([
  "name",
  "description",
  "tagline",
  "services",
  "contact.email",
  "contact.phone",
]);

const SOURCE_TEXT_LIMIT = 60_000;

function withSourceText(company: CompanyData, text: string): CompanyData {
  return companyDataSchema.parse({
    ...company,
    sourceText: (text || company.sourceText || "").slice(0, SOURCE_TEXT_LIMIT),
  });
}

/** Pause Create for a quick review when extraction is thin or guessed. */
export function needsExtractReview(company: CompanyData): boolean {
  if (!company.name?.trim() || /^your company$/i.test(company.name.trim())) return true;
  const offerings = company.services.length + company.products.length;
  // Document-rich extract — trust it and skip the gate
  if ((company.sourceText?.length || 0) > 400 && offerings >= 2 && company.description.length >= 40) {
    return false;
  }
  if ((company.description || "").trim().length < 40) return true;
  if (!offerings) return true;
  const criticalHits = company.uncertainFields.filter((f) => CRITICAL_UNCERTAIN.has(f));
  return criticalHits.length >= 2;
}

export function heuristicExtract(text: string, brandColor: string): CompanyData {
  const lines = firstLines(text, 12);
  const name = lines[0]?.slice(0, 80) || "Your company";
  const tagline = lines[1]?.slice(0, 140) || "Professional services you can trust.";
  const email = guessEmail(text);
  const phone = guessPhone(text);
  const uncertain: string[] = [];
  if (!email) uncertain.push("contact.email");
  if (!phone) uncertain.push("contact.phone");
  if (lines.length < 3) uncertain.push("description", "services");

  const serviceMatches = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 8 && line.length < 120)
    .slice(0, 16)
    .map((title) => ({ title, description: "", price: "" }));

  return withSourceText(
    companyDataSchema.parse({
      name,
      tagline,
      industry: "",
      description: text.slice(0, 1200),
      services: serviceMatches.length ? serviceMatches : [{ title: "Consulting", description: "", price: "" }],
      products: [],
      contact: { email, phone, address: "", website: "", whatsapp: "", hours: "" },
      social: {
        linkedin: "",
        twitter: "",
        facebook: "",
        instagram: "",
        youtube: "",
        tiktok: "",
        telegram: "",
        whatsapp: "",
      },
      media: [],
      brandColor,
      palette: [brandColor],
      tone: "friendly",
      uncertainFields: [...uncertain, "industry", "social"],
      highlights: lines.slice(2, 8),
      faqs: [],
      team: [],
      testimonials: [],
    }),
    text,
  );
}

export function extractFromQuestions(answers: FiveQuestions, brandColor: string): CompanyData {
  const offerings = answers.offerings
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((title) => ({ title, description: "", price: "" }));

  const email = guessEmail(answers.contact);
  const phone = guessPhone(answers.contact);
  const source = `Company: ${answers.companyName}\nTagline: ${answers.oneLiner}\nAudience: ${answers.audience}\nOfferings: ${answers.offerings}\nContact: ${answers.contact}`;

  return withSourceText(
    companyDataSchema.parse({
      name: answers.companyName,
      tagline: answers.oneLiner,
      industry: "",
      description: `${answers.oneLiner} We work with ${answers.audience}.`,
      services: offerings,
      products: [],
      contact: {
        email,
        phone,
        address: email || phone ? "" : answers.contact,
        website: "",
        whatsapp: "",
        hours: "",
      },
      social: {
        linkedin: "",
        twitter: "",
        facebook: "",
        instagram: "",
        youtube: "",
        tiktok: "",
        telegram: "",
        whatsapp: "",
      },
      media: [],
      brandColor,
      palette: [brandColor],
      tone: "friendly",
      uncertainFields: ["industry", "social", "brandColor"],
      highlights: [answers.oneLiner, `Audience: ${answers.audience}`].filter(Boolean),
      faqs: [],
      team: [],
      testimonials: [],
    }),
    source,
  );
}

export async function extractCompanyData(input: {
  text: string;
  brandColor: string;
}): Promise<CompanyData> {
  const fallback = heuristicExtract(input.text, input.brandColor);
  const raw = await completeJson(
    `You are a meticulous document-to-website extractor. Your job is to pull EVERY usable fact from the PDF/brochure/menu into structured JSON so a website can be built from the document alone.

Return ONLY valid JSON matching this shape:
{
  "name": string,
  "tagline": string (sharp homepage line from their real positioning),
  "industry": string,
  "description": string (3-6 sentences grounded in the document — who they are, what they do, who they serve),
  "services": [{"title": string, "description": string, "price": string}],
  "products": [{"title": string, "description": string, "price": string}],
  "contact": {"email": string, "phone": string, "address": string, "website": string, "whatsapp": string, "hours": string},
  "social": {"linkedin": string, "twitter": string, "facebook": string, "instagram": string, "youtube": string, "tiktok": string, "telegram": string, "whatsapp": string},
  "tone": "formal" | "friendly" | "technical",
  "uncertainFields": string[],
  "highlights": string[] (important facts, differentiators, certifications, stats — verbatim when possible),
  "faqs": [{"question": string, "answer": string}],
  "team": [{"name": string, "role": string, "bio": string}],
  "testimonials": [{"quote": string, "author": string, "role": string}]
}

Hard rules:
- Extract ALL services, products, menu items, packages, treatments, or offerings listed in the document (up to 24 each). Include prices when shown.
- Put opening hours / operating hours into contact.hours exactly as written when present.
- Pull address, phone, email, WhatsApp, website, and socials only when present — never invent.
- If the doc has FAQs, team bios, or client quotes, extract them; otherwise use empty arrays.
- Prefer the document's own wording over marketing fluff you invent.
- highlights should capture concrete facts (years of experience, locations, specialties, guarantees).
- If something is missing, leave it empty and list the field in uncertainFields.`,
    `Brand color sampled from logo: ${input.brandColor}\n\n--- DOCUMENT START ---\n${input.text.slice(0, SOURCE_TEXT_LIMIT)}\n--- DOCUMENT END ---`,
    8192,
  );

  if (!raw) return fallback;
  const parsed = companyDataSchema.safeParse({
    ...(raw as object),
    brandColor: input.brandColor,
    palette: [input.brandColor],
  });
  if (!parsed.success) return fallback;
  return withSourceText(parsed.data, input.text);
}

function formatOfferingLine(item: { title: string; description?: string; price?: string }) {
  const bits = [item.title];
  if (item.price?.trim()) bits.push(`(${item.price.trim()})`);
  if (item.description?.trim()) bits.push(`— ${item.description.trim()}`);
  return bits.join(" ");
}

function aboutBodyFromCompany(company: CompanyData): string {
  const parts: string[] = [];
  if (company.description.trim()) parts.push(company.description.trim());
  if (company.highlights.length) {
    parts.push(company.highlights.map((h) => `• ${h}`).join("\n"));
  }
  if (company.team.length) {
    parts.push(
      "Team\n" +
        company.team
          .map((m) => `• ${m.name}${m.role ? ` — ${m.role}` : ""}${m.bio ? `: ${m.bio}` : ""}`)
          .join("\n"),
    );
  }
  if (company.faqs.length) {
    parts.push(
      "FAQ\n" + company.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n"),
    );
  }
  return parts.join("\n\n").slice(0, 8000);
}

function templateCopy(company: CompanyData): SiteContentMap {
  const offerings = company.services.length ? company.services : company.products;
  const primary = offerings[0];
  const audienceHint = company.industry ? ` for ${company.industry.toLowerCase()} clients` : "";
  const serviceItems = company.services.length
    ? company.services.map((s) => ({
        title: s.price ? `${s.title} — ${s.price}` : s.title,
        description: s.description,
      }))
    : [{ title: "Consultation", description: "A clear plan tailored to your goals." }];
  const productItems = company.products.map((s) => ({
    title: s.price ? `${s.title} — ${s.price}` : s.title,
    description: s.description,
  }));

  const testimonialItems = company.testimonials.length
    ? company.testimonials
    : [
        {
          quote: `${company.name} made everything straightforward — grounded in what they actually offer.`,
          author: "A recent client",
          role: company.industry || "Customer",
        },
      ];

  const contactBodyParts = [
    "Reach out — we typically reply within one business day.",
    company.contact.hours ? `Hours: ${company.contact.hours}` : "",
  ].filter(Boolean);

  return {
    hero: {
      headline: company.tagline || `Welcome to ${company.name}`,
      subheadline:
        company.description.slice(0, 320) ||
        (primary
          ? `${company.name} delivers ${primary.title.toLowerCase()}${audienceHint}.`
          : `${company.name} — clear, professional, ready to grow.`),
      ctaLabel: company.contact.whatsapp ? "Chat on WhatsApp" : "Get in touch",
      ctaHref: "#contact",
    },
    about: {
      title: `About ${company.name}`,
      body: aboutBodyFromCompany(company),
    },
    services: {
      title: company.services.length > 8 ? "Full menu of services" : "What we offer",
      items: serviceItems,
    },
    products: {
      title: "Products",
      items: productItems,
    },
    testimonials: {
      title: company.testimonials.length ? "What clients say" : "Trusted by clients",
      items: testimonialItems,
    },
    cta: {
      headline: `Ready to work with ${company.name}?`,
      body: company.tagline || "Tell us what you need. We’ll reply within one business day.",
      buttonLabel: "Contact us",
    },
    contact: {
      title: "Contact",
      body: contactBodyParts.join(" "),
      email: company.contact.email,
      phone: company.contact.phone,
      address: company.contact.address,
      whatsapp: company.contact.whatsapp,
      hours: company.contact.hours,
    },
    gallery: {
      title: company.media.some((m) => m.kind === "video") ? "Photos & videos" : "Gallery",
      body: company.media.length ? "A look at our work and materials." : "",
    },
    footer: {
      blurb: offerings[0]
        ? `${company.name} — ${offerings[0].title.toLowerCase()} and more.`
        : `${company.name}.`,
    },
  };
}

function mergeValidatedContent(
  base: SiteContentMap,
  partial: Partial<SiteContentMap> | undefined,
): SiteContentMap {
  if (!partial) return base;
  const next = { ...base };
  for (const key of SECTION_KEYS) {
    const incoming = partial[key];
    if (!incoming || typeof incoming !== "object") continue;
    const schema = sectionSchemas[key];
    const parsed = schema.safeParse({ ...base[key], ...incoming });
    if (parsed.success) {
      (next as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return next;
}

function defaultSectionOrder(company: CompanyData): SectionKey[] {
  return [...SECTION_KEYS].filter((key) => {
    if (key === "services" && company.services.length === 0) return false;
    if (key === "products" && company.products.length === 0) return false;
    if (key === "gallery" && company.media.length === 0) return false;
    return true;
  });
}

export async function generateSiteContent(input: {
  company: CompanyData;
  mode: "template" | "ai_custom";
  templateId: TemplateId;
}): Promise<{
  content: SiteContentMap;
  layoutVariant: LayoutVariant;
  palette: string[];
  sectionOrder: SectionKey[];
}> {
  const base = templateCopy(input.company);
  const sectionOrder = defaultSectionOrder(input.company);

  if (input.mode === "template") {
    return {
      content: base,
      layoutVariant: "standard",
      palette: input.company.palette.length ? input.company.palette : [input.company.brandColor],
      sectionOrder,
    };
  }

  const mediaNote = input.company.media.length
    ? `Media available: ${input.company.media.map((m) => m.kind).join(", ")} (${input.company.media.length} files). Include gallery.`
    : "No media files — omit gallery from sectionOrder.";

  const { sourceText, ...companyWithoutSource } = input.company;
  const documentBlock = (sourceText || "").slice(0, 40_000);

  const raw = await completeJson(
    `You are an elite website builder. The user uploaded a real company document. Your job is to put the DOCUMENT'S DATA onto the website — not invent a generic brochure.

Return ONLY JSON:
{
  "layoutVariant": "standard" | "split" | "stacked" | "asymmetric",
  "palette": string[] (4-5 hex colors, accessible, derived from brandColor),
  "sectionOrder": string[] (subset of hero, about, services, products, gallery, testimonials, cta, contact, footer — hero first, footer last),
  "content": {
    "hero": {"headline": string, "subheadline": string, "ctaLabel": string, "ctaHref": "#contact"},
    "about": {"title": string, "body": string},
    "services": {"title": string, "items": [{"title": string, "description": string}]},
    "products": {"title": string, "items": [{"title": string, "description": string}]},
    "gallery": {"title": string, "body": string},
    "testimonials": {"title": string, "items": [{"quote": string, "author": string, "role": string}]},
    "cta": {"headline": string, "body": string, "buttonLabel": string},
    "contact": {"title": string, "body": string, "email": string, "phone": string, "address": string, "whatsapp": string, "hours": string},
    "footer": {"blurb": string}
  }
}

Document-grounding rules (critical):
- Use names, offerings, prices, hours, addresses, phone, email, WhatsApp, team, FAQs, and quotes FROM THE DOCUMENT / structured company JSON.
- services.items and products.items MUST include every offering from the structured data (titles + descriptions + prices when available). Do not drop items to "look cleaner".
- about.body should weave description + highlights + team + FAQs from the document (use line breaks). Keep it factual.
- contact.* must match document facts only. Put opening hours in contact.hours and mention them in contact.body.
- testimonials: use real quotes from the document when present; otherwise one short generic line (no fake names of real people).
- Never invent phone numbers, emails, addresses, prices, or clinic/company facts not in the source.
- Hero can polish wording but must reflect the real tagline/positioning.
- Tone must match company.tone. Template hint: ${input.templateId}.
- ${mediaNote}`,
    JSON.stringify({
      company: companyWithoutSource,
      offeringChecklist: {
        services: input.company.services.map(formatOfferingLine),
        products: input.company.products.map(formatOfferingLine),
      },
      sourceDocument: documentBlock || "(no raw document text — use structured company fields only)",
    }),
    8192,
  );

  if (!raw || typeof raw !== "object") {
    return {
      content: base,
      layoutVariant: "split",
      palette: input.company.palette,
      sectionOrder,
    };
  }

  const data = raw as {
    layoutVariant?: LayoutVariant;
    palette?: string[];
    sectionOrder?: SectionKey[];
    content?: Partial<SiteContentMap>;
  };

  const order =
    data.sectionOrder?.filter((k) => SECTION_KEYS.includes(k)).length
      ? data.sectionOrder.filter((k) => SECTION_KEYS.includes(k))
      : sectionOrder;

  let content = mergeValidatedContent(base, data.content);

  // Never let the model silently drop offerings extracted from the document
  if (input.company.services.length) {
    const aiItems = content.services?.items || [];
    if (aiItems.length < input.company.services.length) {
      content = {
        ...content,
        services: {
          title: content.services?.title || base.services.title,
          items: base.services.items,
        },
      };
    }
  }
  if (input.company.products.length) {
    const aiItems = content.products?.items || [];
    if (aiItems.length < input.company.products.length) {
      content = {
        ...content,
        products: {
          title: content.products?.title || base.products.title,
          items: base.products.items,
        },
      };
    }
  }
  // Preserve document contact facts if the model emptied them
  content = {
    ...content,
    contact: {
      ...content.contact,
      email: content.contact.email || input.company.contact.email,
      phone: content.contact.phone || input.company.contact.phone,
      address: content.contact.address || input.company.contact.address,
      whatsapp: content.contact.whatsapp || input.company.contact.whatsapp,
      hours: content.contact.hours || input.company.contact.hours,
    },
  };

  return {
    content,
    layoutVariant: data.layoutVariant || "split",
    palette: data.palette?.length ? data.palette : input.company.palette,
    sectionOrder: order,
  };
}

export async function regenerateSection(input: {
  company: CompanyData;
  sectionKey: SectionKey;
  current: Record<string, unknown>;
}) {
  const raw = await completeJson(
    `Rewrite only this website section to a higher quality bar (v0-level clarity).
Keep facts accurate (names, contact, offerings). Improve specificity and rhythm.
Return ONLY the JSON object for the section (${input.sectionKey}), no wrapper.`,
    JSON.stringify({
      company: input.company,
      sectionKey: input.sectionKey,
      current: input.current,
    }),
    2048,
  );
  if (raw && typeof raw === "object") {
    const schema = sectionSchemas[input.sectionKey];
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data as Record<string, unknown>;
    return raw as Record<string, unknown>;
  }
  return input.current;
}

export type IterateResult = {
  summary: string;
  content: SiteContentMap;
  sectionOrder: SectionKey[];
  palette?: string[];
  layoutVariant?: LayoutVariant;
};

/** Chat-style iterate: apply a natural-language instruction to the whole site (or focused section). */
export async function iterateSiteContent(input: {
  company: CompanyData;
  content: Partial<SiteContentMap>;
  sectionOrder: SectionKey[];
  instruction: string;
  focusSection?: SectionKey | null;
  templateId: TemplateId;
  layoutVariant: LayoutVariant;
  palette: string[];
}): Promise<IterateResult> {
  const base = mergeValidatedContent(templateCopy(input.company), input.content as Partial<SiteContentMap>);
  const focus = input.focusSection
    ? `Focus changes primarily on the "${input.focusSection}" section, but you may lightly adjust adjacent sections if needed for coherence.`
    : "You may update any sections needed to fulfill the instruction.";

  const raw = await completeJson(
    `You are an in-editor AI for a website builder (like v0 chat).
The user gives an instruction; you return an updated site JSON. Preserve contact facts and real offerings.

${focus}

Return ONLY JSON:
{
  "summary": string (one short sentence describing what you changed),
  "layoutVariant": "standard" | "split" | "stacked" | "asymmetric",
  "palette": string[] (optional; only if colors should change),
  "sectionOrder": string[] (optional; only if order/sections should change),
  "content": { ...same section shapes as the site; include every section you change; omit unchanged sections }
}

Rules:
- Do not invent emails, phones, addresses, or social handles.
- Keep brand voice. Prefer concrete edits over rewriting everything.
- Template context: ${input.templateId}.`,
    JSON.stringify({
      instruction: input.instruction,
      company: input.company,
      sectionOrder: input.sectionOrder,
      layoutVariant: input.layoutVariant,
      palette: input.palette,
      content: base,
    }),
    8192,
  );

  if (!raw || typeof raw !== "object") {
    return {
      summary: "Could not apply that change automatically. Try a more specific instruction.",
      content: base,
      sectionOrder: input.sectionOrder,
    };
  }

  const data = raw as {
    summary?: string;
    layoutVariant?: LayoutVariant;
    palette?: string[];
    sectionOrder?: SectionKey[];
    content?: Partial<SiteContentMap>;
  };

  const order =
    data.sectionOrder?.filter((k) => SECTION_KEYS.includes(k)).length
      ? data.sectionOrder.filter((k) => SECTION_KEYS.includes(k))
      : input.sectionOrder;

  return {
    summary: data.summary || "Updated the site from your instruction.",
    content: mergeValidatedContent(base, data.content),
    sectionOrder: order,
    palette: data.palette,
    layoutVariant: data.layoutVariant,
  };
}
