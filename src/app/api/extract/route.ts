import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { extractCompanyData, extractFromQuestions, needsExtractReview } from "@/lib/llm/pipeline";
import {
  companyDataSchema,
  fiveQuestionsSchema,
  linksInputSchema,
  type CompanyData,
  type LinksInput,
  type MediaItem,
} from "@/types/content";
import { uniqueSubdomain } from "@/lib/sites";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";
export const maxDuration = 60;

async function ownedSite(siteId: string, tenantId: string) {
  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site || site.tenantId !== tenantId) return null;
  return site;
}

function mergeLinksAndMedia(
  company: CompanyData,
  links: LinksInput,
  media: MediaItem[],
): CompanyData {
  return companyDataSchema.parse({
    ...company,
    contact: {
      ...company.contact,
      email: links.email || company.contact.email,
      phone: links.phone || company.contact.phone,
      website: links.website || company.contact.website,
      whatsapp: links.whatsapp || company.contact.whatsapp,
      hours: company.contact.hours || "",
    },
    social: {
      ...company.social,
      linkedin: links.linkedin || company.social.linkedin,
      twitter: links.twitter || company.social.twitter,
      facebook: links.facebook || company.social.facebook,
      instagram: links.instagram || company.social.instagram,
      youtube: links.youtube || company.social.youtube,
      tiktok: links.tiktok || company.social.tiktok,
      telegram: links.telegram || company.social.telegram,
      whatsapp: links.whatsapp || company.social.whatsapp,
    },
    media: media.length ? media : company.media,
  });
}

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const body = (await request.json()) as {
    siteId?: string;
    text?: string;
    brandColor?: string;
    questions?: unknown;
    links?: unknown;
    media?: MediaItem[];
  };
  if (!body.siteId) {
    return NextResponse.json({ error: "Missing site." }, { status: 400 });
  }
  const site = await ownedSite(body.siteId, session.tenantId);
  if (!site) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  const brandColor = body.brandColor || "#1A1714";
  const links = linksInputSchema.parse(body.links ?? {});
  const media = Array.isArray(body.media) ? body.media : [];

  let company: CompanyData;
  try {
    if (body.questions) {
      const parsed = fiveQuestionsSchema.safeParse(body.questions);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Please answer all five questions so we have enough to work with." },
          { status: 400 },
        );
      }
      company = extractFromQuestions(parsed.data, brandColor);
    } else if (body.text?.trim()) {
      company = await extractCompanyData({ text: body.text, brandColor });
    } else if (
      media.length ||
      links.email ||
      links.whatsapp ||
      links.instagram ||
      links.facebook ||
      links.website
    ) {
      company = companyDataSchema.parse({
        name: links.website?.replace(/^https?:\/\//, "").split("/")[0] || "Your company",
        tagline: "Welcome — explore our work and get in touch.",
        industry: "",
        description: "Browse our gallery and reach us through the links below.",
        services: [],
        products: [],
        contact: {
          email: links.email || "",
          phone: links.phone || "",
          address: "",
          website: links.website || "",
          whatsapp: links.whatsapp || "",
          hours: "",
        },
        social: {
          linkedin: links.linkedin || "",
          twitter: links.twitter || "",
          facebook: links.facebook || "",
          instagram: links.instagram || "",
          youtube: links.youtube || "",
          tiktok: links.tiktok || "",
          telegram: links.telegram || "",
          whatsapp: links.whatsapp || "",
        },
        media,
        brandColor,
        palette: [brandColor],
        tone: "friendly",
        uncertainFields: ["name", "description"],
        sourceText: "",
        highlights: [],
        faqs: [],
        team: [],
        testimonials: [],
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Add a PDF, photos/videos, paste text, links, or answer the five questions so we have something to build from.",
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        error: "We had trouble reading that. Try pasting the text, or answer the quick questions instead.",
      },
      { status: 422 },
    );
  }

  company = mergeLinksAndMedia(company, links, media);

  const db = getDb();
  const subdomain = await uniqueSubdomain(slugify(company.name) || site.subdomain);
  await db
    .update(sites)
    .set({
      name: company.name,
      subdomain,
      companyData: company,
      palette: company.palette,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, site.id));

  return NextResponse.json({
    company,
    subdomain,
    needsReview: needsExtractReview(company),
    uncertainFields: company.uncertainFields,
  });
}
