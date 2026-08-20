import "server-only";

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function shift(hex: string, amount: number) {
  const raw = hex.replace("#", "");
  const n = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return toHex(r, g, b);
}

export async function colorsFromLogo(buffer: Buffer) {
  const sharp = (await import("sharp")).default;
  try {
    const stats = await sharp(buffer).resize(80, 80, { fit: "cover" }).stats();
    const { r, g, b } = stats.dominant;
    const brand = toHex(r, g, b);
    return {
      brandColor: brand,
      palette: [brand, shift(brand, 40), shift(brand, -40), "#F7F3EC", "#1A1714"],
    };
  } catch {
    return {
      brandColor: "#1A1714",
      palette: ["#1A1714", "#C45C26", "#F7F3EC"],
    };
  }
}
