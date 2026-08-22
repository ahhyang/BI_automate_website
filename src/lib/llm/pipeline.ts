import Anthropic from "@anthropic-ai/sdk";
import {
  companyDataSchema,
  type CompanyData,
  type FiveQuestions,
  type SiteContentMap,
  type TemplateId,
  type LayoutVariant,
  type SectionKey,
  SECTION_KEYS,
} from "@/types/content";

const MODEL = "claude-sonnet-4-5";

function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

async function completeJson(system: string, user: string) {
  const anthropic = client();
  if (!anthropic) return null;
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
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
    .filter((line) => line.length > 8 && line.length < 80)
    .slice(0, 4)
    .map((title) => ({ title, description: `Learn more about ${title.toLowerCase()}.` }));

  return companyDataSchema.parse({
    name,
    tagline,
    industry: "",
    description: text.slice(0, 600),
    services: serviceMatches.length ? serviceMatches : [{ title: "Consulting", description: "" }],
    products: [],
    contact: { email, phone, address: "", website: "", whatsapp: "" },
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
  });
}

export function extractFromQuestions(answers: FiveQuestions, brandColor: string): CompanyData {
  const offerings = answers.offerings
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((title) => ({ title, description: "" }));

  const email = guessEmail(answers.contact);
  const phone = guessPhone(answers.contact);

  return companyDataSchema.parse({
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
  });
}

export async function extractCompanyData(input: {
  text: string;
  brandColor: string;
}): Promise<CompanyData> {
  const fallback = heuristicExtract(input.text, input.brandColor);
  const raw = await completeJson(
    `You extract structured company data from messy documents. Return ONLY valid JSON matching this shape:
{
  "name": string,
  "tagline": string,
  "industry": string,
  "description": string (1-3 sentences),
  "services": [{"title": string, "description": string}],
  "products": [{"title": string, "description": string}],
  "contact": {"email": string, "phone": string, "address": string, "website": string, "whatsapp": string},
  "social": {"linkedin": string, "twitter": string, "facebook": string, "instagram": string, "youtube": string, "tiktok": string, "telegram": string, "whatsapp": string},
  "tone": "formal" | "friendly" | "technical",
  "uncertainFields": string[] (dot-paths for anything you guessed or could not find)
}
Do not invent phone numbers, emails, or addresses. Leave them empty and list them in uncertainFields. Keep services/products to what the document actually mentions.`,
    `Brand color sampled from logo: ${input.brandColor}\n\nDocument:\n${input.text.slice(0, 20000)}`,
  );

  if (!raw) return fallback;
  const parsed = companyDataSchema.safeParse({
    ...(raw as object),
    brandColor: input.brandColor,
    palette: [input.brandColor],
  });
  return parsed.success ? parsed.data : fallback;
}

function templateCopy(company: CompanyData): SiteContentMap {
  const offerings = company.services.length ? company.services : company.products;
  return {
    hero: {
      headline: company.tagline || company.name,
      subheadline: company.description,
      ctaLabel: "Get in touch",
      ctaHref: "#contact",
    },
    about: {
      title: `About ${company.name}`,
      body: company.description,
    },
    services: {
      title: "Services",
      items: company.services,
    },
    products: {
      title: "Products",
      items: company.products,
    },
    testimonials: {
      title: "What clients say",
      items: [
        {
          quote: `${company.name} made the process straightforward and the result looks like a real company site.`,
          author: "A recent client",
          role: company.industry || "Customer",
        },
      ],
    },
    cta: {
      headline: `Work with ${company.name}`,
      body: company.tagline || "Tell us what you need. We'll take it from there.",
      buttonLabel: "Contact us",
    },
    contact: {
      title: "Contact",
      body: "Reach out — we typically reply within one business day.",
      email: company.contact.email,
      phone: company.contact.phone,
      address: company.contact.address,
      whatsapp: company.contact.whatsapp,
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
  const sectionOrder: SectionKey[] = [...SECTION_KEYS].filter((key) => {
    if (key === "services" && input.company.services.length === 0) return false;
    if (key === "products" && input.company.products.length === 0) return false;
    if (key === "gallery" && input.company.media.length === 0) return false;
    return true;
  });

  if (input.mode === "template") {
    return {
      content: base,
      layoutVariant: "standard",
      palette: input.company.palette.length ? input.company.palette : [input.company.brandColor],
      sectionOrder,
    };
  }

  const raw = await completeJson(
    `You write website copy for a small-business marketing site. Return ONLY JSON:
{
  "layoutVariant": "standard" | "split" | "stacked" | "asymmetric",
  "palette": string[] (4-5 hex colors, accessible, based on brandColor),
  "sectionOrder": string[] (subset of hero, about, services, products, gallery, testimonials, cta, contact, footer — hero first, footer last),
  "content": {
    "hero": {"headline": string, "subheadline": string, "ctaLabel": string, "ctaHref": "#contact"},
    "about": {"title": string, "body": string},
    "services": {"title": string, "items": [{"title": string, "description": string}]},
    "products": {"title": string, "items": [{"title": string, "description": string}]},
    "gallery": {"title": string, "body": string},
    "testimonials": {"title": string, "items": [{"quote": string, "author": string, "role": string}]},
    "cta": {"headline": string, "body": string, "buttonLabel": string},
    "contact": {"title": string, "body": string, "email": string, "phone": string, "address": string, "whatsapp": string},
    "footer": {"blurb": string}
  }
}
Rules: do not invent contact details. Include gallery only if the company has media. Keep contrast-friendly hex colors. Max 9 sections. Tone must match the company tone. Template hint: ${input.templateId}.`,
    JSON.stringify(input.company),
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

  return {
    content: { ...base, ...data.content },
    layoutVariant: data.layoutVariant || "split",
    palette: data.palette?.length ? data.palette : input.company.palette,
    sectionOrder: data.sectionOrder?.length ? data.sectionOrder : sectionOrder,
  };
}

export async function regenerateSection(input: {
  company: CompanyData;
  sectionKey: SectionKey;
  current: Record<string, unknown>;
}) {
  const raw = await completeJson(
    `Rewrite only this website section. Keep facts (names, contact, offerings) accurate. Return ONLY the JSON object for the section, no wrapper.`,
    JSON.stringify({
      company: input.company,
      sectionKey: input.sectionKey,
      current: input.current,
    }),
  );
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return input.current;
}
