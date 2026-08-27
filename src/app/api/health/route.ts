import { NextResponse } from "next/server";
import { isLlmConfigured } from "@/lib/llm/pipeline";

export function GET() {
  const openRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    ok: true,
    multiTenant: true,
    perCustomerProjects: false,
    ai: {
      configured: isLlmConfigured(),
      openRouter,
      anthropic,
      model: openRouter
        ? process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4"
        : anthropic
          ? process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"
          : null,
    },
  });
}
