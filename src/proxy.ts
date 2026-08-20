import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_SUBDOMAINS, parseHost } from "./lib/host";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/examples") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const parsed = parseHost(request.headers.get("host"));
  const hostname = request.headers.get("host") || "";

  if (parsed.customDomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/s/_custom/${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(request.headers);
    headers.set("x-siteform-custom-domain", parsed.customDomain);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (parsed.subdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${parsed.subdomain}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  const host = hostname.split(":")[0];
  if (host.endsWith(".localhost")) {
    const sub = host.replace(/\.localhost$/, "");
    if (DEMO_SUBDOMAINS.includes(sub as (typeof DEMO_SUBDOMAINS)[number])) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${sub}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
