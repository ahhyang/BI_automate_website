const STOP = new Set(["the", "and", "of", "a", "an", "for", "llc", "inc", "ltd", "pty"]);

export function slugify(input: string) {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .split(/[\s_]+/)
    .filter((part) => part && !STOP.has(part))
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return slug || "site";
}

export function withSuffix(base: string, n: number) {
  const suffix = `-${n}`;
  return `${base.slice(0, 48 - suffix.length)}${suffix}`;
}
