import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { extractCompanyData, extractFromQuestions } from "@/lib/llm/pipeline";
import { fiveQuestionsSchema } from "@/types/content";
import { uniqueSubdomain } from "@/lib/sites";
import { slugify } from "@/lib/slug";

async function ownedSite(siteId: string, tenantId: string) {
  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site || site.tenantId !== tenantId) return null;
  return site;
}

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const body = (await request.json()) as {
    siteId?: string;
    text?: string;
    brandColor?: string;
    questions?: unknown;
  };
  if (!body.siteId) {
    return NextResponse.json({ error: "Missing site." }, { status: 400 });
  }
  const site = await ownedSite(body.siteId, session.tenantId);
  if (!site) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  const brandColor = body.brandColor || "#1A1714";
  let company;
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
    } else {
      return NextResponse.json(
        {
          error: "We need a document, pasted text, or the five quick questions before we can continue.",
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

  return NextResponse.json({ company, subdomain });
}
