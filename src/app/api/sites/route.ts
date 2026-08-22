import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { siteContent, sites } from "@/lib/db/schema";
import { companyDataSchema, type SectionKey, type TemplateId } from "@/types/content";

export async function PATCH(request: Request) {
  const session = await ensureGuestSession();
  const body = (await request.json()) as {
    siteId?: string;
    company?: unknown;
    templateId?: TemplateId;
    sectionOrder?: SectionKey[];
    section?: { key: SectionKey; content: Record<string, unknown> };
    subdomain?: string;
  };
  if (!body.siteId) return NextResponse.json({ error: "Missing site." }, { status: 400 });
  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
  if (!site || site.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  if (body.subdomain !== undefined) {
    const { slugify } = await import("@/lib/slug");
    const { RESERVED_SUBDOMAINS, DEMO_SUBDOMAINS } = await import("@/lib/host");
    const next = slugify(body.subdomain);
    if (!next || next.length < 2) {
      return NextResponse.json({ error: "Pick a longer address (at least 2 characters)." }, { status: 400 });
    }
    if (RESERVED_SUBDOMAINS.has(next) || DEMO_SUBDOMAINS.includes(next as (typeof DEMO_SUBDOMAINS)[number])) {
      return NextResponse.json({ error: "That address is reserved. Try another." }, { status: 409 });
    }
    const [taken] = await db.select({ id: sites.id }).from(sites).where(eq(sites.subdomain, next)).limit(1);
    if (taken && taken.id !== site.id) {
      return NextResponse.json({ error: "That address is already taken." }, { status: 409 });
    }
    await db.update(sites).set({ subdomain: next, updatedAt: new Date() }).where(eq(sites.id, site.id));
  }

  if (body.company) {
    const company = companyDataSchema.parse(body.company);
    await db
      .update(sites)
      .set({ name: company.name, companyData: company, updatedAt: new Date() })
      .where(eq(sites.id, site.id));
  }
  if (body.templateId) {
    await db
      .update(sites)
      .set({ templateId: body.templateId, updatedAt: new Date() })
      .where(eq(sites.id, site.id));
  }
  if (body.section) {
    await db
      .update(siteContent)
      .set({ contentJson: body.section.content })
      .where(and(eq(siteContent.siteId, site.id), eq(siteContent.sectionKey, body.section.key)));
  }
  if (body.sectionOrder) {
    await Promise.all(
      body.sectionOrder.map((key, index) =>
        db
          .update(siteContent)
          .set({ sortOrder: index })
          .where(and(eq(siteContent.siteId, site.id), eq(siteContent.sectionKey, key))),
      ),
    );
  }

  return NextResponse.json({ ok: true });
}
