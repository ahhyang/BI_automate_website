import { NextResponse } from "next/server";
import { isLlmConfigured } from "@/lib/llm/pipeline";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Live OpenRouter/Anthropic smoke test. Hits the same chat path site generation uses.
 * GET /api/ai/ping
 */
export async function GET() {
  if (!isLlmConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "No OPENROUTER_API_KEY or ANTHROPIC_API_KEY on this server.",
      },
      { status: 503 },
    );
  }

  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: true,
      provider: "anthropic",
      note: "Anthropic key present; OpenRouter not set. Generation uses Anthropic SDK.",
    });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://siteform-omega.vercel.app",
        "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Siteform",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with exactly: PONG" }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
      model?: string;
      usage?: unknown;
    };
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          error: json.error?.message || res.statusText,
          model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      provider: "openrouter",
      model: json.model || process.env.OPENROUTER_MODEL,
      reply: json.choices?.[0]?.message?.content || "",
      usage: json.usage || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ping failed",
      },
      { status: 502 },
    );
  }
}
