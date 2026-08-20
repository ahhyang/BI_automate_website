import { NextResponse } from "next/server";
import { ensureGuestSession } from "@/lib/auth";

export async function GET(request: Request) {
  await ensureGuestSession();
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/create";
  const dest = next.startsWith("/") ? next : "/create";
  return NextResponse.redirect(new URL(dest, url.origin));
}

export async function POST() {
  const session = await ensureGuestSession();
  return NextResponse.json(session);
}
