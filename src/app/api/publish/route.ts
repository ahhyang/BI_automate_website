import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession, ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { siteUrl } from "@/lib/host";
import { isOpenAccess } from "@/lib/plans";

export async function POST(request: Request) {
  const open = isOpenAccess();
  const session = open ? await ensureGuestSession() : await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Create a free account to publish and keep this site." },
      { status: 401 },
    );
  }
  if (session.isGuest && !open) {
    return NextResponse.json(
      { error: "Create a free account to publish and keep this site.", code: "signup_required" },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { siteId?: string };
  if (!body.siteId) return NextResponse.json({ error: "Missing site." }, { status: 400 });

  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
  if (!site || site.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  await db
    .update(sites)
    .set({ status: "live", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(sites.id, site.id));

  return NextResponse.json({
    url: siteUrl(site.subdomain),
    subdomain: site.subdomain,
  });
}
