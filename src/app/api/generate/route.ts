import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureGuestSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generationJobs, sites, tenants } from "@/lib/db/schema";
import { generateSiteContent } from "@/lib/llm/pipeline";
import { companyDataSchema, TEMPLATE_IDS, type TemplateId } from "@/types/content";
import { getEntitlements, incrementUsage } from "@/lib/usage";
import { saveSiteContent } from "@/lib/sites";

type Step = { key: string; label: string; status: "pending" | "running" | "done" | "failed" };

export const runtime = "nodejs";

const STEPS: { key: string; label: string }[] = [
  { key: "copy", label: "Writing homepage copy" },
  { key: "structure", label: "Building page structure" },
  { key: "colors", label: "Applying brand colors" },
  { key: "provision", label: "Provisioning your site" },
  { key: "ready", label: "Preview ready" },
];

export async function POST(request: Request) {
  const session = await ensureGuestSession();
  const body = (await request.json()) as {
    siteId?: string;
    mode?: "template" | "ai_custom";
    templateId?: TemplateId;
  };
  if (!body.siteId) return NextResponse.json({ error: "Missing site." }, { status: 400 });

  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
  if (!site || site.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "We couldn't find that site." }, { status: 404 });
  }

  const mode = body.mode === "ai_custom" ? "ai_custom" : "template";
  const entitlements = await getEntitlements(session.tenantId);
  if (mode === "ai_custom" && !entitlements.canUseAiCustom) {
    return NextResponse.json(
      { error: "AI Custom is a Pro feature.", code: "upgrade_required", reason: "ai_custom" },
      { status: 402 },
    );
  }

  const templateId = TEMPLATE_IDS.includes(body.templateId as TemplateId)
    ? (body.templateId as TemplateId)
    : "classic";

  const [job] = await db
    .insert(generationJobs)
    .values({
      siteId: site.id,
      tenantId: session.tenantId,
      status: "running",
      steps: STEPS.map((step, i): Step => ({
        ...step,
        status: i === 0 ? "running" : "pending",
      })),
      notifyEmail: session.email,
    })
    .returning();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const setSteps = async (doneThrough: number, failed?: boolean) => {
        const steps: Step[] = STEPS.map((step, i) => ({
          ...step,
          status:
            failed && i === doneThrough
              ? "failed"
              : i < doneThrough
                ? "done"
                : i === doneThrough
                  ? "running"
                  : "pending",
        }));
        await db
          .update(generationJobs)
          .set({ steps, updatedAt: new Date(), status: failed ? "failed" : "running" })
          .where(eq(generationJobs.id, job.id));
        send("steps", steps);
      };

      try {
        const parsedCompany = companyDataSchema.safeParse(site.companyData ?? {});
        if (!parsedCompany.success) {
          send("error", { message: "Review company details first, then generate the site." });
          controller.close();
          return;
        }
        const company = parsedCompany.data;
        await setSteps(1);
        send("status", { message: STEPS[0].label });
        await setSteps(2);
        const generated = await generateSiteContent({ company, mode, templateId });
        await setSteps(3);
        await db
          .update(sites)
          .set({
            templateId,
            generationMode: mode,
            layoutVariant: generated.layoutVariant,
            palette: generated.palette,
            status: "draft",
            updatedAt: new Date(),
          })
          .where(eq(sites.id, site.id));
        await setSteps(4);
        await saveSiteContent(site.id, generated.content, generated.sectionOrder);
        if (mode === "ai_custom") {
          await incrementUsage(session.tenantId, "aiGenerationsUsed");
          if (!entitlements.plan.aiCustomEnabled) {
            await db
              .update(tenants)
              .set({ aiCustomTrialUsed: true })
              .where(eq(tenants.id, session.tenantId));
          }
        }
        await setSteps(5);
        await db
          .update(generationJobs)
          .set({
            status: "done",
            steps: STEPS.map((step) => ({ ...step, status: "done" })),
            updatedAt: new Date(),
          })
          .where(eq(generationJobs.id, job.id));
        send("done", { siteId: site.id, jobId: job.id });
      } catch {
        await db
          .update(generationJobs)
          .set({
            status: "failed",
            errorMessage: "Generation didn't finish. You can try Quick Template, or retry in a moment.",
            updatedAt: new Date(),
          })
          .where(eq(generationJobs.id, job.id));
        send("error", {
          message: "Generation didn't finish. Try Quick Template, or retry in a moment.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
