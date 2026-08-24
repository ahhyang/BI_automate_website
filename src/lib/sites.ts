import { and, eq, asc } from "drizzle-orm";
import { getDb } from "./db";
import { sites, siteContent, tenants } from "./db/schema";
import {
  companyDataSchema,
  SECTION_KEYS,
  DEFAULT_THEME,
  themeSettingsSchema,
  type CompanyData,
  type SectionKey,
  type SiteContentMap,
  type SiteRenderModel,
  type TemplateId,
  type LayoutVariant,
} from "@/types/content";
import { getPlan } from "./plans";

export async function uniqueSubdomain(base: string) {
  const db = getDb();
  const { slugify, withSuffix } = await import("./slug");
  const { RESERVED_SUBDOMAINS, DEMO_SUBDOMAINS } = await import("./host");
  let candidate = slugify(base);
  if (RESERVED_SUBDOMAINS.has(candidate) || DEMO_SUBDOMAINS.includes(candidate as (typeof DEMO_SUBDOMAINS)[number])) {
    candidate = withSuffix(candidate, 2);
  }
  for (let i = 2; i < 50; i++) {
    const [existing] = await db.select({ id: sites.id }).from(sites).where(eq(sites.subdomain, candidate)).limit(1);
    if (!existing) return candidate;
    candidate = withSuffix(slugify(base), i);
  }
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

export async function loadSiteModel(opts: {
  subdomain?: string;
  customDomain?: string;
  siteId?: string;
}): Promise<(SiteRenderModel & { siteId: string; tenantId: string; status: string }) | null> {
  const db = getDb();
  const filters = [];
  if (opts.subdomain) filters.push(eq(sites.subdomain, opts.subdomain));
  if (opts.customDomain) filters.push(eq(sites.customDomain, opts.customDomain));
  if (opts.siteId) filters.push(eq(sites.id, opts.siteId));
  if (!filters.length) return null;

  const [row] = await db.select().from(sites).where(and(...filters)).limit(1);
  if (!row) return null;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, row.tenantId)).limit(1);
  const contentRows = await db
    .select()
    .from(siteContent)
    .where(eq(siteContent.siteId, row.id))
    .orderBy(asc(siteContent.sortOrder));

  const content: Partial<SiteContentMap> = {};
  const sectionOrder: SectionKey[] = [];
  for (const item of contentRows) {
    const key = item.sectionKey as SectionKey;
    if (SECTION_KEYS.includes(key)) {
      content[key] = item.contentJson as never;
      sectionOrder.push(key);
    }
  }

  const parsed = companyDataSchema.safeParse(row.companyData ?? {});
  const company = parsed.success
    ? parsed.data
    : emptyCompany({ name: row.name, palette: row.palette ?? [] });

  const plan = getPlan(tenant?.plan);
  const themeParsed = themeSettingsSchema.safeParse(company.siteTheme ?? {});
  const theme = themeParsed.success ? themeParsed.data : DEFAULT_THEME;

  return {
    siteId: row.id,
    tenantId: row.tenantId,
    status: row.status,
    name: row.name,
    subdomain: row.subdomain,
    logoUrl: row.logoUrl,
    templateId: (row.templateId as TemplateId) || "classic",
    layoutVariant: (row.layoutVariant as LayoutVariant) || "standard",
    brandColor: company.brandColor,
    palette: row.palette?.length ? row.palette : company.palette,
    hideBadge: plan.hideBadge,
    theme,
    company,
    content,
    sectionOrder: sectionOrder.length ? sectionOrder : [...SECTION_KEYS],
  };
}

export async function saveSiteContent(
  siteId: string,
  content: Partial<SiteContentMap>,
  sectionOrder: SectionKey[],
) {
  const db = getDb();
  await db.delete(siteContent).where(eq(siteContent.siteId, siteId));
  if (!sectionOrder.length) return;
  await db.insert(siteContent).values(
    sectionOrder.map((key, index) => ({
      siteId,
      sectionKey: key,
      sortOrder: index,
      contentJson: (content[key] ?? {}) as Record<string, unknown>,
    })),
  );
}

export function emptyCompany(partial?: Partial<CompanyData>): CompanyData {
  return {
    name: "",
    tagline: "",
    industry: "",
    description: "",
    services: [],
    products: [],
    contact: { email: "", phone: "", address: "", website: "", whatsapp: "", hours: "" },
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
    brandColor: "#1A1714",
    palette: [],
    tone: "friendly",
    uncertainFields: [],
    sourceText: "",
    sourceMarkdown: "",
    sitePlan: "",
    generationPrompt: "",
    highlights: [],
    faqs: [],
    team: [],
    testimonials: [],
    ...partial,
  };
}
