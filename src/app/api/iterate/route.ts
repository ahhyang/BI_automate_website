import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { iterateSiteContent } from "@/lib/llm/pipeline";
import {
  companyDataSchema,
  type LayoutVariant,
  type SectionKey,
  type SiteContentMap,
  type TemplateId,
} from "@/types/content";
import { getEntitlements, incrementUsage } from "@/lib/usage";
import { loadSiteModel, saveSiteContent } from "@/lib/sites";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const body = (await request.json()) as {
    siteId?: string;
    instruction?: string;
    focusSection?: SectionKey | null;
  };

  const instruction = body.instruction?.trim() || "";
  if (!body.siteId || instruction.length < 3) {
    return NextResponse.json(
      { error: "Describe what to change (at least a few words)." },
      { status: 400 },
    );
  }
  if (instruction.length > 2000) {
    return NextResponse.json({ error: "Keep the instruction under 2000 characters." }, { status: 400 });
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

  const model = await loadSiteModel({ siteId: body.siteId });
  if (!model || model.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  const parsedCompany = companyDataSchema.safeParse(model.company);
  if (!parsedCompany.success) {
    return NextResponse.json({ error: "Company data is incomplete." }, { status: 400 });
  }

  const result = await iterateSiteContent({
    company: parsedCompany.data,
    content: model.content,
    sectionOrder: model.sectionOrder,
    instruction,
    focusSection: body.focusSection || null,
    templateId: model.templateId as TemplateId,
    layoutVariant: model.layoutVariant as LayoutVariant,
    palette: model.palette,
  });

  const db = getDb();
  await saveSiteContent(model.siteId, result.content, result.sectionOrder);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (result.palette?.length) patch.palette = result.palette;
  if (result.layoutVariant) patch.layoutVariant = result.layoutVariant;
  await db.update(sites).set(patch).where(eq(sites.id, model.siteId));

  await incrementUsage(session.tenantId, "regenerationsUsed");

  return NextResponse.json({
    summary: result.summary,
    content: result.content as SiteContentMap,
    sectionOrder: result.sectionOrder,
    palette: result.palette || model.palette,
    layoutVariant: result.layoutVariant || model.layoutVariant,
  });
}
