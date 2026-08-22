import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites, uploads } from "@/lib/db/schema";
import { mediaKindFromFile, storeFile } from "@/lib/storage";
import { colorsFromLogo } from "@/lib/logo-colors";
import { getEntitlements } from "@/lib/usage";
import { uniqueSubdomain } from "@/lib/sites";
import type { MediaItem } from "@/types/content";
import { linksInputSchema } from "@/types/content";

const MAX_MEDIA = 24;
const MAX_BYTES = 40 * 1024 * 1024;

function isTextDoc(file: File) {
  const n = file.name.toLowerCase();
  return (
    file.type.includes("pdf") ||
    file.type.includes("word") ||
    file.type.includes("text") ||
    n.endsWith(".pdf") ||
    n.endsWith(".docx") ||
    n.endsWith(".txt")
  );
}

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const entitlements = await getEntitlements(session.tenantId);
  const form = await request.formData();
  const logo = form.get("logo");
  const pasted = String(form.get("pasted") || "");
  let siteId = String(form.get("siteId") || "");

  const docs = form.getAll("doc").filter((f): f is File => f instanceof File && f.size > 0);
  const mediaFiles = form
    .getAll("media")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_MEDIA);

  let links = linksInputSchema.parse({});
  const linksRaw = form.get("links");
  if (typeof linksRaw === "string" && linksRaw.trim()) {
    try {
      links = linksInputSchema.parse(JSON.parse(linksRaw));
    } catch {
      /* ignore */
    }
  }

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
    if (logo.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo is too large (max 40MB).", siteId }, { status: 413 });
    }
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
  const media: MediaItem[] = [];

  for (const doc of docs) {
    if (doc.size > MAX_BYTES) {
      return NextResponse.json({ error: `${doc.name} is too large (max 40MB).`, siteId }, { status: 413 });
    }
    const stored = await storeFile(doc, "docs");
    let text = "";
    if (isTextDoc(doc)) {
      try {
        const { extractDocumentText } = await import("@/lib/parsing/extract-text");
        text = await extractDocumentText(doc);
        if (!parsedText) parsedText = text;
        else parsedText += `\n\n${text}`;
      } catch (error) {
        if (!parsedText && docs.length === 1 && mediaFiles.length === 0 && !pasted.trim()) {
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "We couldn't read that file. Try pasting text, or answer the quick questions.",
              siteId,
            },
            { status: 422 },
          );
        }
      }
    }
    await db.insert(uploads).values({
      tenantId: session.tenantId,
      siteId,
      type: "doc",
      storageUrl: stored.url,
      filename: doc.name,
      mimeType: doc.type,
      parsedText: text || null,
    });
    media.push({
      id: nanoid(12),
      kind: "pdf",
      url: stored.url,
      filename: doc.name,
      caption: "",
      mimeType: doc.type,
    });
  }

  for (const file of mediaFiles) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `${file.name} is too large (max 40MB).`, siteId }, { status: 413 });
    }
    const kind = mediaKindFromFile(file);
    if (!kind) continue;
    const folder = kind === "photo" ? "photos" : kind === "video" ? "videos" : "docs";
    const stored = await storeFile(file, folder);
    const item: MediaItem = {
      id: nanoid(12),
      kind,
      url: stored.url,
      filename: file.name,
      caption: "",
      mimeType: file.type,
    };
    media.push(item);
    await db.insert(uploads).values({
      tenantId: session.tenantId,
      siteId,
      type: kind,
      storageUrl: stored.url,
      filename: file.name,
      mimeType: file.type,
      parsedJson: item as unknown as Record<string, unknown>,
    });
  }

  return NextResponse.json({
    siteId,
    parsedText,
    logoUrl,
    brandColor,
    palette,
    media,
    links,
    hasDocument: Boolean(parsedText),
  });
}
