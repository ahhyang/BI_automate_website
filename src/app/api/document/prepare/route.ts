import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites, uploads } from "@/lib/db/schema";
import { organizeDocumentForSite } from "@/lib/llm/pipeline";
import { analyzeGatheredInfo } from "@/lib/intelligence/gather-insights";
import { companyDataSchema, linksInputSchema, mediaItemSchema } from "@/types/content";
import { uniqueSubdomain } from "@/lib/sites";
import { slugify } from "@/lib/slug";
import { MIN_USEFUL_CHARS } from "@/lib/parsing/extract-text";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Extract → Markdown → plan → prompt → structured form data.
 * Always returns a review payload; never silently invents company copy from a filename.
 */
export async function POST(request: Request) {
  try {
    const session = await ensureGuestSession();
    const body = (await request.json()) as {
      siteId?: string;
      text?: string;
      brandColor?: string;
      links?: unknown;
      media?: unknown[];
    };

    if (!body.siteId) {
      return NextResponse.json({ error: "Missing site." }, { status: 400 });
    }

    const db = getDb();
    const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
    if (!site || site.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
    }

    let text = (body.text || "").trim();
    if (text.length < MIN_USEFUL_CHARS) {
      const rows = await db.select().from(uploads).where(eq(uploads.siteId, site.id));
      const fromUploads = rows
        .map((r) => r.parsedText || "")
        .filter((t) => t.trim().length >= MIN_USEFUL_CHARS)
        .join("\n\n");
      text = fromUploads.trim();
    }

    if (text.length < MIN_USEFUL_CHARS) {
      return NextResponse.json(
        {
          error:
            "We couldn't get readable text from your document. Paste the PDF content below, or upload a text-based PDF (not a scan).",
          code: "no_document_text",
        },
        { status: 422 },
      );
    }

    // Reject poisoned placeholders from older uploads
    if (/^Company document uploaded:/i.test(text) && text.length < 400) {
      return NextResponse.json(
        {
          error:
            "The PDF was not actually read (scan or empty text layer). Paste the document text, then try again.",
          code: "no_document_text",
        },
        { status: 422 },
      );
    }

    const brandColor = body.brandColor || "#1A1714";
    const links = linksInputSchema.parse(body.links ?? {});
    const linksHint = Object.entries(links)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const organized = await organizeDocumentForSite({
      text,
      brandColor,
      linksHint,
    });

    let company = organized.company;
    const uploadedMedia = Array.isArray(body.media)
      ? body.media
          .map((m) => mediaItemSchema.safeParse(m))
          .filter((r) => r.success)
          .map((r) => r.data)
      : [];

    company = companyDataSchema.parse({
      ...company,
      media: uploadedMedia.length ? uploadedMedia : company.media,
      contact: {
        ...company.contact,
        email: links.email || company.contact.email,
        phone: links.phone || company.contact.phone,
        website: links.website || company.contact.website,
        whatsapp: links.whatsapp || company.contact.whatsapp,
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
    });

    const insights = analyzeGatheredInfo(company);

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
      siteId: site.id,
      subdomain,
      markdown: organized.markdown,
      plan: organized.plan,
      prompt: organized.prompt,
      company,
      insights,
    });
  } catch (error) {
    console.error("[document/prepare]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not organize the document. Paste the text and try again.",
      },
      { status: 500 },
    );
  }
}
