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
const MAX_BYTES = 4.5 * 1024 * 1024;
const EXTRACT_TIMEOUT_MS = 55_000;

export const maxDuration = 120;
export const runtime = "nodejs";

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

async function extractWithTimeout(file: File) {
  const { extractDocumentText } = await import("@/lib/parsing/extract-text");
  return await Promise.race([
    extractDocumentText(file),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("Document read timed out")), EXTRACT_TIMEOUT_MS),
    ),
  ]);
}

export async function POST(request: Request) {
  try {
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
        return NextResponse.json({ error: "Logo is too large (max 4.5 MB).", siteId }, { status: 413 });
      }
      try {
        const stored = await storeFile(logo, "logos");
        logoUrl = stored.url;
        try {
          const colors = await colorsFromLogo(stored.bytes);
          brandColor = colors.brandColor;
          palette = colors.palette;
        } catch {
          /* keep defaults */
        }
        await db.insert(uploads).values({
          tenantId: session.tenantId,
          siteId,
          type: "logo",
          storageUrl: stored.url,
          filename: logo.name,
          mimeType: logo.type,
        });
        await db.update(sites).set({ logoUrl, palette, updatedAt: new Date() }).where(eq(sites.id, siteId));
      } catch {
        /* logo optional — continue without it */
      }
    }

    let parsedText = pasted.trim();
    const media: MediaItem[] = [];
    const warnings: string[] = [];

    for (const doc of docs) {
      if (doc.size > MAX_BYTES) {
        return NextResponse.json(
          {
            error: `${doc.name} is too large (${(doc.size / (1024 * 1024)).toFixed(1)} MB). Max is 4.5 MB.`,
            siteId,
          },
          { status: 413 },
        );
      }

      let storageUrl = "";
      try {
        const stored = await storeFile(doc, "docs");
        storageUrl = stored.url;
      } catch {
        warnings.push(`Saved text from “${doc.name}” but file storage was unavailable.`);
      }

      let text = "";
      if (isTextDoc(doc)) {
        try {
          text = await extractWithTimeout(doc);
          if (text.length > 80_000) text = text.slice(0, 80_000);
          if (!parsedText) parsedText = text;
          else parsedText += `\n\n${text}`;
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : `Could not read “${doc.name}”. Paste the text or use a text-based PDF.`;
          warnings.push(msg);
          // Do NOT invent placeholder "Company document uploaded…" text — that poisons extraction.
        }
      }

      if (!storageUrl) {
        // Keep a stable placeholder so gallery can still list the doc name
        storageUrl = `#doc-${nanoid(8)}`;
      }

      await db.insert(uploads).values({
        tenantId: session.tenantId,
        siteId,
        type: "doc",
        storageUrl,
        filename: doc.name,
        mimeType: doc.type,
        parsedText: text || null,
      });
      media.push({
        id: nanoid(12),
        kind: "pdf",
        url: storageUrl.startsWith("#") ? "" : storageUrl,
        filename: doc.name,
        caption: "",
        mimeType: doc.type,
      });
    }

    for (const file of mediaFiles) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          {
            error: `${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max is 4.5 MB.`,
            siteId,
          },
          { status: 413 },
        );
      }
      const kind = mediaKindFromFile(file);
      if (!kind) continue;
      const folder = kind === "photo" ? "photos" : kind === "video" ? "videos" : "docs";
      try {
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
      } catch {
        warnings.push(`Skipped media file “${file.name}” (storage unavailable).`);
      }
    }

    if (!parsedText && !media.length && !pasted.trim()) {
      return NextResponse.json(
        { error: "Nothing usable was uploaded. Try again or paste text.", siteId },
        { status: 422 },
      );
    }

    if (!parsedText) {
      parsedText = `Files uploaded: ${[...docs, ...mediaFiles].map((f) => f.name).join(", ") || "media"}. Build a professional site using the contact links provided.`;
    }

    return NextResponse.json({
      siteId,
      parsedText,
      logoUrl,
      brandColor,
      palette,
      media: media.filter((m) => m.url || m.filename),
      links,
      hasDocument: Boolean(parsedText),
      warning: warnings[0],
    });
  } catch (error) {
    console.error("[upload]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload failed on the server. Try pasting text, or try again with a simpler PDF.",
      },
      { status: 500 },
    );
  }
}
