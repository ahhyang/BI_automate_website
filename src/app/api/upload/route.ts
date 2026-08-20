import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites, uploads } from "@/lib/db/schema";
import { storeFile } from "@/lib/storage";
import { colorsFromLogo } from "@/lib/logo-colors";
import { getEntitlements } from "@/lib/usage";
import { uniqueSubdomain } from "@/lib/sites";

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const entitlements = await getEntitlements(session.tenantId);
  const form = await request.formData();
  const logo = form.get("logo");
  const doc = form.get("doc");
  const pasted = String(form.get("pasted") || "");
  let siteId = String(form.get("siteId") || "");

  const db = getDb();

  if (!siteId) {
    if (!entitlements.canCreateSite) {
      return NextResponse.json(
        { error: "Your free plan includes one site.", code: "upgrade_required", reason: "site_limit" },
        { status: 402 },
      );
    }
    const subdomain = await uniqueSubdomain("site");
    const [site] = await db
      .insert(sites)
      .values({
        tenantId: session.tenantId,
        name: "Untitled site",
        subdomain,
        status: "draft",
      })
      .returning();
    siteId = site.id;
  } else {
    const [owned] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!owned || owned.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
    }
  }

  let logoUrl: string | undefined;
  let brandColor = "#1A1714";
  let palette: string[] = [brandColor];

  if (logo instanceof File && logo.size > 0) {
    const stored = await storeFile(logo, "logos");
    logoUrl = stored.url;
    const colors = await colorsFromLogo(Buffer.from(await logo.arrayBuffer()));
    brandColor = colors.brandColor;
    palette = colors.palette;
    await db.insert(uploads).values({
      tenantId: session.tenantId,
      siteId,
      type: "logo",
      storageUrl: stored.url,
      filename: logo.name,
      mimeType: logo.type,
    });
    await db.update(sites).set({ logoUrl, palette, updatedAt: new Date() }).where(eq(sites.id, siteId));
  }

  let parsedText = pasted.trim();
  if (doc instanceof File && doc.size > 0) {
    const stored = await storeFile(doc, "docs");
    const { extractDocumentText } = await import("@/lib/parsing/extract-text");
    try {
      parsedText = await extractDocumentText(doc);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "We couldn't read that file. Try uploading as text, or answer the quick questions instead.",
          siteId,
        },
        { status: 422 },
      );
    }
    await db.insert(uploads).values({
      tenantId: session.tenantId,
      siteId,
      type: "doc",
      storageUrl: stored.url,
      filename: doc.name,
      mimeType: doc.type,
      parsedText,
    });
  }

  return NextResponse.json({
    siteId,
    parsedText,
    logoUrl,
    brandColor,
    palette,
    hasDocument: Boolean(parsedText),
  });
}
