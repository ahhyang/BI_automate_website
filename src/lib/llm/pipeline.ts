import Anthropic from "@anthropic-ai/sdk";
import {
  analyzeGatheredInfo,
  buildContentBlueprint,
  inferDocumentType,
  smartSectionOrder,
  type DocumentType,
} from "@/lib/intelligence/gather-insights";
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

/** Anthropic SDK appends `/v1/messages` — OpenRouter host must be `/api` (not `/api/v1`). */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api";

export function isLlmConfigured(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

function client(): { anthropic: Anthropic; model: string; provider: "openrouter" | "anthropic" } | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      anthropic: new Anthropic({
        apiKey: openRouterKey,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://siteform-omega.vercel.app",
          "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Siteform",
        },
      }),
      model: OPENROUTER_MODEL,
      provider: "openrouter",
    };
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      anthropic: new Anthropic({ apiKey: anthropicKey }),
      model: ANTHROPIC_MODEL,
      provider: "anthropic",
    };
  }
  return null;
}

function llmErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return String(error || "unknown error");
  const err = error as { status?: number; message?: string; error?: { message?: string } };
  const detail = err.error?.message || err.message || "request failed";
  if (err.status === 401 || err.status === 403) {
    return `AI auth failed (${err.status}). Check OPENROUTER_API_KEY on the server.`;
  }
  if (err.status === 402) {
    return "OpenRouter reports insufficient credits. Top up and retry.";
  }
  if (err.status === 429) {
    return "AI rate limit hit. Wait a moment and retry.";
  }
  return `AI request failed${err.status ? ` (${err.status})` : ""}: ${detail}`.slice(0, 280);
}

async function completeJson(system: string, user: string, maxTokens = 4096) {
  const wired = client();
  if (!wired) {
    console.warn("[llm] No OPENROUTER_API_KEY or ANTHROPIC_API_KEY configured");
    return null;
  }
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
    if (!match) {
      console.warn(`[llm] ${wired.provider} returned no JSON object`);
      return null;
    }
    return JSON.parse(match[0]) as unknown;
  } catch (error) {
    console.error(`[llm] completeJson via ${wired.provider}:`, llmErrorMessage(error));
    throw new Error(llmErrorMessage(error));
  }
}

async function completeText(system: string, user: string, maxTokens = 4096) {
  const wired = client();
  if (!wired) {
    console.warn("[llm] No OPENROUTER_API_KEY or ANTHROPIC_API_KEY configured");
    return null;
  }
  try {
    const message = await wired.anthropic.messages.create({
      model: wired.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    return message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
  } catch (error) {
    console.error(`[llm] completeText via ${wired.provider}:`, llmErrorMessage(error));
    throw new Error(llmErrorMessage(error));
  }
}

/** Soft LLM call — returns null on failure instead of throwing (for optional polish steps). */
async function tryCompleteJson(system: string, user: string, maxTokens = 4096) {
  try {
    return await completeJson(system, user, maxTokens);
  } catch {
    return null;
  }
}

async function tryCompleteText(system: string, user: string, maxTokens = 4096) {
  try {
    return await completeText(system, user, maxTokens);
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
  const clipped = (text || company.sourceText || "").slice(0, SOURCE_TEXT_LIMIT);
  return companyDataSchema.parse({
    ...company,
    sourceText: clipped,
    sourceMarkdown: company.sourceMarkdown?.trim() ? company.sourceMarkdown : clipped,
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
  const raw = await tryCompleteJson(
    `You convert a document into structured website fields. Be smart about document type.

Return ONLY valid JSON:
{
  "documentType": "resume" | "personal_brand" | "company" | "clinic" | "restaurant_menu" | "brochure" | "other",
  "name": string,
  "tagline": string,
  "industry": string,
  "description": string,
  "services": [{"title": string, "description": string, "price": string}],
  "products": [{"title": string, "description": string, "price": string}],
  "contact": {"email": string, "phone": string, "address": string, "website": string, "whatsapp": string, "hours": string},
  "social": {"linkedin": string, "twitter": string, "facebook": string, "instagram": string, "youtube": string, "tiktok": string, "telegram": string, "whatsapp": string},
  "tone": "formal" | "friendly" | "technical",
  "uncertainFields": string[],
  "highlights": string[],
  "faqs": [{"question": string, "answer": string}],
  "team": [{"name": string, "role": string, "bio": string}],
  "testimonials": [{"quote": string, "author": string, "role": string}]
}

Document-type rules (critical):
1) RESUME / CV / KEY PERSONNEL PROFILE / personal profile:
   - name = the PERSON's real name (e.g. "Yong Cherng Hann"), NEVER a section header like "KEY PERSONNEL PROFILE", "PROFESSIONAL SUMMARY", "EXPERIENCE", "EDUCATION".
   - tagline = role / headline (e.g. "Software Engineer · Full-Stack & Mobile").
   - industry = their field (e.g. "Software Engineering").
   - description = rewrite professional summary into 3–5 website-ready sentences (still factual).
   - services = capabilities they offer clients (e.g. Full-Stack Web, Flutter Mobile, AI/LLM Integration) — NOT phone/email/headers.
   - products = notable projects/apps from the resume (title + one-line what it does).
   - team = usually empty for a personal site (or one entry for themselves).
   - highlights = achievements, years, stack, awards — NOT contact lines duplicated.
2) COMPANY / CLINIC / BROCHURE / MENU:
   - name = business/clinic brand name (not a form title).
   - services/products = real offerings with prices when present.
3) NEVER put phone, email, or address into services/products/highlights.
4) NEVER invent contact details; empty string + uncertainFields if missing.
5) Prefer real wording from the document.`,
    `Brand color: ${input.brandColor}\n\n--- DOCUMENT ---\n${input.text.slice(0, SOURCE_TEXT_LIMIT)}\n--- END ---`,
    8192,
  );

  if (!raw) return sanitizeStructuredCompany(fallback, input.text);
  const parsed = companyDataSchema.safeParse({
    ...(raw as object),
    brandColor: input.brandColor,
    palette: [input.brandColor],
  });
  if (!parsed.success) return sanitizeStructuredCompany(fallback, input.text);
  return withSourceText(sanitizeStructuredCompany(parsed.data, input.text), input.text);
}

const HEADERISH =
  /^(key\s+personnel|personnel\s+profile|professional\s+summary|work\s+experience|education|skills|contact|profile|curriculum\s+vitae|\bresume\b|\bcv\b|about\s+me|references)$/i;

function looksLikeSectionHeader(value: string) {
  const v = value.trim();
  if (!v) return true;
  if (HEADERISH.test(v)) return true;
  if (v === v.toUpperCase() && v.length > 8 && v.length < 60 && !/[a-z]/.test(v)) return true;
  return false;
}

function guessPersonName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 20)) {
    if (looksLikeSectionHeader(line)) continue;
    if (/@|https?:|phone|\+?\d[\d\s-]{6,}/i.test(line)) continue;
    if (line.length >= 3 && line.length <= 60 && /[A-Za-z]/.test(line)) {
      // Prefer lines that look like names (2–4 words, not all caps headers)
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 5) return line.replace(/\s*\(.*\)\s*$/, "").trim();
    }
  }
  return "";
}

/** Fix common bad mappings (headers as name, contact dumped into services). */
export function sanitizeStructuredCompany(company: CompanyData, sourceText: string): CompanyData {
  let name = company.name.trim();
  let tagline = company.tagline.trim();
  if (looksLikeSectionHeader(name) || /^key software/i.test(name)) {
    name = guessPersonName(sourceText) || guessPersonName(company.description) || name;
  }
  if (looksLikeSectionHeader(tagline) || tagline.toLowerCase() === name.toLowerCase()) {
    const roleLine = sourceText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) =>
        /engineer|developer|designer|consultant|doctor|clinic|founder|specialist/i.test(l) &&
        !looksLikeSectionHeader(l) &&
        l.length < 80,
      );
    tagline = roleLine || company.industry || tagline;
  }

  const contactBits = new Set(
    [company.contact.email, company.contact.phone, company.contact.whatsapp, company.contact.address]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const cleanOffering = (items: CompanyData["services"]) =>
    items.filter((item) => {
      const t = item.title.trim();
      if (!t || looksLikeSectionHeader(t)) return false;
      if (contactBits.has(t.toLowerCase())) return false;
      if (/^(phone|email|tel|whatsapp|address)\b/i.test(t)) return false;
      if (t.toLowerCase() === name.toLowerCase()) return false;
      return true;
    });

  const services = cleanOffering(company.services);
  const products = cleanOffering(company.products);
  const highlights = company.highlights.filter((h) => {
    const t = h.trim();
    if (!t || looksLikeSectionHeader(t)) return false;
    if (contactBits.has(t.toLowerCase())) return false;
    if (/^(phone|email)\b/i.test(t)) return false;
    if (t.toLowerCase() === name.toLowerCase()) return false;
    return true;
  });

  return companyDataSchema.parse({
    ...company,
    name: name || company.name,
    tagline: tagline || company.tagline,
    services,
    products,
    highlights,
  });
}

export type DocumentPlanResult = {
  markdown: string;
  plan: string;
  prompt: string;
  company: CompanyData;
};

/**
 * Turn raw document text into: clean Markdown → site plan → generation prompt → structured form data.
 * Always shown to the user before Create generates the site.
 */
export async function organizeDocumentForSite(input: {
  text: string;
  brandColor: string;
  linksHint?: string;
}): Promise<DocumentPlanResult> {
  const source = input.text.slice(0, SOURCE_TEXT_LIMIT);
  const brandColor = input.brandColor || "#1A1714";

  // If the text already looks like cleaned markdown, skip a redundant rewrite pass.
  const alreadyMd = /^#\s+/m.test(source) && source.length > 200;
  const markdown =
    alreadyMd
      ? source
      : (await tryCompleteText(
          `You clean and structure messy document text into clear Markdown for a website build.
Output ONLY markdown. Use # / ## headings, lists, and tables when useful.
Keep every factual detail: names, offerings, prices, hours, contacts, team, FAQs, testimonials.
Do not invent content. Do not wrap in code fences.`,
          `--- RAW DOCUMENT ---\n${source}\n--- END ---`,
          8192,
        )) || source;

  const bundled = await tryCompleteJson(
    `You are a senior website strategist. From the document markdown, produce ONE JSON object with smart structured fields, a site plan, and a generation prompt.

Return ONLY JSON:
{
  "documentType": "resume" | "personal_brand" | "company" | "clinic" | "restaurant_menu" | "brochure" | "other",
  "company": {
    "name": string,
    "tagline": string,
    "industry": string,
    "description": string,
    "services": [{"title": string, "description": string, "price": string}],
    "products": [{"title": string, "description": string, "price": string}],
    "contact": {"email": string, "phone": string, "address": string, "website": string, "whatsapp": string, "hours": string},
    "social": {"linkedin": string, "twitter": string, "facebook": string, "instagram": string, "youtube": string, "tiktok": string, "telegram": string, "whatsapp": string},
    "tone": "formal" | "friendly" | "technical",
    "uncertainFields": string[],
    "highlights": string[],
    "faqs": [{"question": string, "answer": string}],
    "team": [{"name": string, "role": string, "bio": string}],
    "testimonials": [{"quote": string, "author": string, "role": string}]
  },
  "plan": string (markdown site plan: sections, what facts go where, what not to invent),
  "prompt": string (plain-text generation instructions for the website AI)
}

Smart mapping rules:
- If this is a resume/CV/personnel profile: company.name = person's name; tagline = job title; services = skills/services they sell; products = portfolio projects; highlights = achievements. NEVER use section headers (KEY PERSONNEL PROFILE, PROFESSIONAL SUMMARY, etc.) as name or tagline. NEVER put phone/email into services or highlights.
- If company/clinic/menu: name = brand; services/products = offerings with prices.
- plan must be specific to THIS document (mention real name, real offerings/projects).
- prompt must list the exact services/projects to include and forbid inventing contacts.
- Merge any linksHint into contact/social when provided.`,
    JSON.stringify({
      brandColor,
      linksHint: input.linksHint || "",
      markdown: markdown.slice(0, 40_000),
    }),
    8192,
  );

  let company: CompanyData;
  let plan: string;
  let prompt: string;

  if (bundled && typeof bundled === "object") {
    const data = bundled as {
      documentType?: string;
      company?: unknown;
      plan?: string;
      prompt?: string;
    };
    const parsed = companyDataSchema.safeParse({
      ...(data.company as object),
      brandColor,
      palette: [brandColor],
    });
    company = sanitizeStructuredCompany(
      parsed.success ? parsed.data : await extractCompanyData({ text: markdown, brandColor }),
      markdown,
    );
    company = companyDataSchema.parse({
      ...company,
      documentType: resolveDocumentType(data.documentType, company),
    });
    plan =
      (typeof data.plan === "string" && data.plan.trim().length > 40
        ? data.plan.trim()
        : "") || "";
    prompt =
      (typeof data.prompt === "string" && data.prompt.trim().length > 40
        ? data.prompt.trim()
        : "") || "";
  } else {
    company = await extractCompanyData({ text: markdown, brandColor });
    company = companyDataSchema.parse({
      ...company,
      documentType: inferDocumentType(company),
    });
    plan = "";
    prompt = "";
  }

  const insights = analyzeGatheredInfo(company);
  company = companyDataSchema.parse({
    ...company,
    documentType: company.documentType || insights.documentType,
  });

  if (!plan) {
    plan =
      (await tryCompleteText(
        `Write a specific markdown SITE PLAN for this website. Mention the real name and real offerings/projects.
For each section (hero, about, services, products, gallery, contact), say WHICH facts from the document go there.
Document type: ${insights.documentTypeLabel}. No code fences.`,
        JSON.stringify({
          documentType: insights.documentType,
          name: company.name,
          tagline: company.tagline,
          services: company.services,
          products: company.products,
          highlights: company.highlights,
          sectionPlan: insights.sectionPlan,
        }),
        3000,
      )) ||
      insights.sectionPlan
        .map((s) => `- **${s.title}** (${s.section}): ${s.sources.join(", ") || "from brand"}`)
        .join("\n");
  }

  if (!prompt) {
    prompt =
      (await tryCompleteText(
        `Write generation instructions for a website AI. Be specific: list offerings/projects by name.
Map each fact to the correct section. Forbid inventing contacts. Document type: ${insights.documentTypeLabel}. Plain text only.`,
        JSON.stringify({
          documentType: insights.documentType,
          name: company.name,
          tagline: company.tagline,
          services: company.services,
          products: company.products,
          contact: company.contact,
          gaps: insights.gaps.map((g) => g.label),
          plan,
        }),
        3000,
      )) ||
      `Build a professional site for ${company.name} (${company.tagline}).\nInclude services: ${company.services.map((s) => s.title).join("; ")}.\nInclude projects: ${company.products.map((p) => p.title).join("; ")}.\nUse only contact details from the structured data. Do not invent phone/email/address.`;
  }

  const contentBlueprint = buildContentBlueprint(
    companyDataSchema.parse({ ...company, generationPrompt: prompt, sitePlan: plan }),
    insights,
  );

  const enriched = companyDataSchema.parse({
    ...company,
    sourceText: source,
    sourceMarkdown: markdown.slice(0, SOURCE_TEXT_LIMIT),
    sitePlan: plan.slice(0, 20_000),
    generationPrompt: `${prompt.slice(0, 12_000)}\n\n--- CONTENT BLUEPRINT ---\n${contentBlueprint}`.slice(
      0,
      20_000,
    ),
    brandColor,
    palette: company.palette.length ? company.palette : [brandColor],
  });

  return {
    markdown: enriched.sourceMarkdown,
    plan: enriched.sitePlan,
    prompt: enriched.generationPrompt,
    company: enriched,
  };
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
  const docType = company.documentType || inferDocumentType(company);
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
      title:
        docType === "restaurant_menu"
          ? "Menu"
          : docType === "resume" || docType === "personal_brand"
            ? "Skills & services"
            : docType === "clinic"
              ? "Treatments & services"
              : company.services.length > 8
                ? "Full menu of services"
                : "What we offer",
      items: serviceItems,
    },
    products: {
      title: docType === "resume" || docType === "personal_brand" ? "Projects & portfolio" : "Products",
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
  return smartSectionOrder(company, company.documentType);
}

function resolveDocumentType(raw: unknown, company: CompanyData): DocumentType {
  const candidate = typeof raw === "string" ? raw : company.documentType;
  const valid = [
    "resume",
    "personal_brand",
    "company",
    "clinic",
    "restaurant_menu",
    "brochure",
    "other",
  ] as const;
  if (candidate && valid.includes(candidate as DocumentType)) {
    return candidate as DocumentType;
  }
  return inferDocumentType(company);
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

  if (!isLlmConfigured()) {
    throw new Error(
      "AI Custom needs OPENROUTER_API_KEY (or ANTHROPIC_API_KEY) on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    );
  }

  const mediaNote = input.company.media.length
    ? `Media available: ${input.company.media.map((m) => m.kind).join(", ")} (${input.company.media.length} files). Include gallery.`
    : "No media files — omit gallery from sectionOrder.";

  const { sourceText, ...companyWithoutSource } = input.company;
  const documentBlock = (sourceText || "").slice(0, 40_000);

  const insights = analyzeGatheredInfo(input.company);
  const contentBlueprint = buildContentBlueprint(input.company, insights);

  let raw: unknown;
  try {
    raw = await completeJson(
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

Document type: ${insights.documentTypeLabel}. Use section titles appropriate for this type (e.g. "Menu" for restaurant, "Skills" for resume).

Document-grounding rules (critical):
- Follow generationPrompt, sitePlan, and CONTENT BLUEPRINT — they map facts to sections.
- Use names, offerings, prices, hours, addresses, phone, email, WhatsApp, team, FAQs, and quotes FROM THE DOCUMENT / structured company JSON.
- services.items and products.items MUST include every offering from the structured data (titles + descriptions + prices when available). Do not drop items to "look cleaner".
- about.body should weave description + highlights + team + FAQs from the document (use line breaks). Keep it factual.
- contact.* must match document facts only. Put opening hours in contact.hours and mention them in contact.body.
- testimonials: use real quotes from the document when present; otherwise one short generic line (no fake names of real people).
- Never invent phone numbers, emails, addresses, prices, or clinic/company facts not in the source.
- For MISSING fields in the blueprint, use generic copy — do NOT invent specific contact details.
- Hero can polish wording but must reflect the real tagline/positioning.
- Tone must match company.tone. Template hint: ${input.templateId}.
- ${mediaNote}`,
      JSON.stringify({
        company: companyWithoutSource,
        documentType: insights.documentType,
        generationPrompt: input.company.generationPrompt || "",
        sitePlan: input.company.sitePlan || "",
        contentBlueprint,
        sectionPlan: insights.sectionPlan,
        offeringChecklist: {
          services: input.company.services.map(formatOfferingLine),
          products: input.company.products.map(formatOfferingLine),
        },
        sourceDocument: documentBlock || "(no raw document text — use structured company fields only)",
      }),
      8192,
    );
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("AI generation failed. Check OpenRouter and try again.");
  }

  if (!raw || typeof raw !== "object") {
    throw new Error(
      "AI returned an empty response. Check OPENROUTER_MODEL and OpenRouter credits, then retry.",
    );
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
