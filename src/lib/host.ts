export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "static",
  "assets",
  "cdn",
  "dashboard",
  "login",
  "signup",
  "create",
  "billing",
  "examples",
  "preview",
  "status",
  "support",
  "help",
  "docs",
  "blog",
  "s",
  "settings",
]);

export const DEMO_SUBDOMAINS = ["hale-whitmore", "oak-ember", "northline"] as const;

export function getRootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
}

/** True when wildcard DNS isn't available (e.g. *.vercel.app). */
export function usesPathSites() {
  const root = getRootDomain();
  return process.env.NEXT_PUBLIC_PATH_SITES === "1" || root.includes("vercel.app");
}

export function parseHost(hostHeader: string | null) {
  const host = (hostHeader || "").split(":")[0].toLowerCase();
  const root = getRootDomain().split(":")[0].toLowerCase();

  if (!host || host === root || host === "localhost" || host === "127.0.0.1") {
    return { subdomain: null, isTenantHost: false };
  }

  if (host.endsWith(".localhost")) {
    const sub = host.replace(/\.localhost$/, "");
    return {
      subdomain: sub || null,
      isTenantHost: Boolean(sub) && !RESERVED_SUBDOMAINS.has(sub),
    };
  }

  if (host === root || host === `www.${root}`) {
    return { subdomain: null, isTenantHost: false };
  }

  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    if (!sub || sub === "www") {
      return { subdomain: null, isTenantHost: false };
    }
    return {
      subdomain: sub,
      isTenantHost: !RESERVED_SUBDOMAINS.has(sub),
    };
  }

  return { subdomain: null, isTenantHost: false, customDomain: host };
}

export function siteUrl(subdomain: string, path = "/") {
  const root = getRootDomain();
  const protocol = root.includes("localhost") ? "http" : "https";
  // On Vercel preview/production without wildcard DNS, serve at /s/{subdomain}
  if (root.includes("vercel.app") || process.env.NEXT_PUBLIC_PATH_SITES === "1") {
    const suffix = path === "/" ? "" : path;
    return `${protocol}://${root}/s/${subdomain}${suffix}`;
  }
  const suffix = path === "/" ? "" : path;
  return `${protocol}://${subdomain}.${root}${suffix}`;
}

export function appUrl(path = "/") {
  const root = getRootDomain();
  const protocol = root.includes("localhost") ? "http" : "https";
  return `${protocol}://${root}${path}`;
}

export function hostingLabel() {
  return "Siteform Cloud";
}

export function databaseLabel() {
  return "Managed Postgres (included)";
}

export function storageLabel(blobConfigured?: boolean) {
  const on =
    typeof blobConfigured === "boolean"
      ? blobConfigured
      : Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return on ? "Cloud media storage" : "App media storage";
}
