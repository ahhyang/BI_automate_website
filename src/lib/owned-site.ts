import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { sites } from "./db/schema";
import type { Session } from "./auth";

export async function getOwnedSite(siteId: string, session: Session) {
  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site || site.tenantId !== session.tenantId) notFound();
  return site;
}
