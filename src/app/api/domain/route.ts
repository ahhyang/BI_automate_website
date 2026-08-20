import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { getEntitlements } from "@/lib/usage";

async function addVercelDomain(domain: string) {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) return { configured: false as const };
  const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/domains`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });
  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || "Vercel could not attach that domain.");
  }
  return { configured: true as const };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.isGuest) {
    return NextResponse.json({ error: "Create an account first." }, { status: 401 });
  }
  const entitlements = await getEntitlements(session.tenantId);
  if (!entitlements.canCustomDomain) {
    return NextResponse.json(
      { error: "Custom domains are on Pro.", code: "upgrade_required", reason: "custom_domain" },
      { status: 402 },
    );
  }

  const body = (await request.json()) as { siteId?: string; domain?: string };
  const domain = body.domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!body.siteId || !domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Enter a valid domain, like www.acme.com." }, { status: 400 });
  }

  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
  if (!site || site.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  try {
    await addVercelDomain(domain);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We couldn't connect that domain yet. Check the spelling and try again.",
      },
      { status: 422 },
    );
  }

  await db.update(sites).set({ customDomain: domain, updatedAt: new Date() }).where(eq(sites.id, site.id));
  return NextResponse.json({
    domain,
    dns: {
      type: "CNAME",
      name: domain,
      value: "cname.vercel-dns.com",
    },
  });
}
