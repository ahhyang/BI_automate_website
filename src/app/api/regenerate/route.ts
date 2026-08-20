import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { siteContent, sites } from "@/lib/db/schema";
import { regenerateSection } from "@/lib/llm/pipeline";
import { companyDataSchema, type SectionKey } from "@/types/content";
import { getEntitlements, incrementUsage } from "@/lib/usage";

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const body = (await request.json()) as {
    siteId?: string;
    sectionKey?: SectionKey;
    content?: Record<string, unknown>;
  };
  if (!body.siteId || !body.sectionKey) {
    return NextResponse.json({ error: "Missing section to regenerate." }, { status: 400 });
  }

  const entitlements = await getEntitlements(session.tenantId);
  if (!entitlements.canRegenerate) {
    return NextResponse.json(
      {
        error: "You're out of regenerations this month.",
        code: "upgrade_required",
        reason: "regenerations",
      },
      { status: 402 },
    );
  }

  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
  if (!site || site.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  const parsedCompany = companyDataSchema.safeParse(site.companyData ?? {});
  if (!parsedCompany.success) {
    return NextResponse.json(
      { error: "Review company details first, then regenerate a section." },
      { status: 400 },
    );
  }

  const rows = await db.select().from(siteContent).where(eq(siteContent.siteId, site.id));
  const existing = rows.find((item) => item.sectionKey === body.sectionKey);
  const current = body.content || existing?.contentJson || {};

  const next = await regenerateSection({
    company: parsedCompany.data,
    sectionKey: body.sectionKey,
    current,
  });

  if (existing) {
    await db
      .update(siteContent)
      .set({ contentJson: next })
      .where(and(eq(siteContent.id, existing.id), eq(siteContent.siteId, site.id)));
  }

  await incrementUsage(session.tenantId, "regenerationsUsed");
  return NextResponse.json({ content: next });
}
