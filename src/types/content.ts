import { z } from "zod";

export const toneSchema = z.enum(["formal", "friendly", "technical"]);
export type Tone = z.infer<typeof toneSchema>;

export const offeringSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
});

export const mediaItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["photo", "video", "pdf"]),
  url: z.string(),
  filename: z.string().default(""),
  caption: z.string().default(""),
  mimeType: z.string().default(""),
});

export type MediaItem = z.infer<typeof mediaItemSchema>;

export const socialLinksSchema = z.object({
  linkedin: z.string().default(""),
  twitter: z.string().default(""),
  facebook: z.string().default(""),
  instagram: z.string().default(""),
  youtube: z.string().default(""),
  tiktok: z.string().default(""),
  telegram: z.string().default(""),
  whatsapp: z.string().default(""),
});

export type SocialLinks = z.infer<typeof socialLinksSchema>;

export const companyDataSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().default(""),
  industry: z.string().default(""),
  description: z.string().default(""),
  services: z.array(offeringSchema).default([]),
  products: z.array(offeringSchema).default([]),
  contact: z.object({
    email: z.string().default(""),
    phone: z.string().default(""),
    address: z.string().default(""),
    website: z.string().default(""),
    whatsapp: z.string().default(""),
  }),
  social: socialLinksSchema.default({
    linkedin: "",
    twitter: "",
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
    telegram: "",
    whatsapp: "",
  }),
  media: z.array(mediaItemSchema).default([]),
  brandColor: z.string().default("#1A1714"),
  palette: z.array(z.string()).default([]),
  tone: toneSchema.default("friendly"),
  uncertainFields: z.array(z.string()).default([]),
});

export type CompanyData = z.infer<typeof companyDataSchema>;

export const SECTION_KEYS = [
  "hero",
  "about",
  "services",
  "products",
  "gallery",
  "testimonials",
  "cta",
  "contact",
  "footer",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const heroContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().default(""),
  ctaLabel: z.string().default("Get in touch"),
  ctaHref: z.string().default("#contact"),
});

export const aboutContentSchema = z.object({
  title: z.string().default("About"),
  body: z.string().default(""),
});

export const listSectionSchema = z.object({
  title: z.string(),
  items: z.array(offeringSchema).default([]),
});

export const galleryContentSchema = z.object({
  title: z.string().default("Gallery"),
  body: z.string().default(""),
});

export const testimonialsContentSchema = z.object({
  title: z.string().default("What clients say"),
  items: z
    .array(
      z.object({
        quote: z.string(),
        author: z.string().default(""),
        role: z.string().default(""),
      }),
    )
    .default([]),
});

export const ctaContentSchema = z.object({
  headline: z.string(),
  body: z.string().default(""),
  buttonLabel: z.string().default("Contact us"),
});

export const contactContentSchema = z.object({
  title: z.string().default("Contact"),
  body: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  address: z.string().default(""),
  whatsapp: z.string().default(""),
});

export const footerContentSchema = z.object({
  blurb: z.string().default(""),
});

export const sectionSchemas = {
  hero: heroContentSchema,
  about: aboutContentSchema,
  services: listSectionSchema,
  products: listSectionSchema,
  gallery: galleryContentSchema,
  testimonials: testimonialsContentSchema,
  cta: ctaContentSchema,
  contact: contactContentSchema,
  footer: footerContentSchema,
} as const;

export type SiteContentMap = {
  hero: z.infer<typeof heroContentSchema>;
  about: z.infer<typeof aboutContentSchema>;
  services: z.infer<typeof listSectionSchema>;
  products: z.infer<typeof listSectionSchema>;
  gallery: z.infer<typeof galleryContentSchema>;
  testimonials: z.infer<typeof testimonialsContentSchema>;
  cta: z.infer<typeof ctaContentSchema>;
  contact: z.infer<typeof contactContentSchema>;
  footer: z.infer<typeof footerContentSchema>;
};

export const TEMPLATE_IDS = ["classic", "modern", "bold", "editorial"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const LAYOUT_VARIANTS = ["standard", "split", "stacked", "asymmetric"] as const;
export type LayoutVariant = (typeof LAYOUT_VARIANTS)[number];

export type SiteRenderModel = {
  name: string;
  subdomain: string;
  logoUrl: string | null;
  templateId: TemplateId;
  layoutVariant: LayoutVariant;
  brandColor: string;
  palette: string[];
  hideBadge: boolean;
  company: CompanyData;
  content: Partial<SiteContentMap>;
  sectionOrder: SectionKey[];
};

export const fiveQuestionsSchema = z.object({
  companyName: z.string().min(1),
  oneLiner: z.string().min(1),
  audience: z.string().min(1),
  offerings: z.string().min(1),
  contact: z.string().min(1),
});

export type FiveQuestions = z.infer<typeof fiveQuestionsSchema>;

export const linksInputSchema = z.object({
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  website: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  twitter: z.string().optional().default(""),
  facebook: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  youtube: z.string().optional().default(""),
  tiktok: z.string().optional().default(""),
  telegram: z.string().optional().default(""),
});

export type LinksInput = z.infer<typeof linksInputSchema>;

/** Build a clickable URL from a handle, phone, or full URL. */
export function toLinkHref(
  kind: "email" | "phone" | "whatsapp" | "website" | keyof SocialLinks,
  value: string,
) {
  const raw = value.trim();
  if (!raw) return "";
  if (kind === "email") return raw.includes("mailto:") ? raw : `mailto:${raw}`;
  if (kind === "phone") return raw.startsWith("tel:") ? raw : `tel:${raw.replace(/[^\d+]/g, "")}`;
  if (kind === "whatsapp") {
    if (raw.includes("wa.me") || raw.includes("whatsapp.com")) return raw.startsWith("http") ? raw : `https://${raw}`;
    const digits = raw.replace(/[^\d]/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
  if (kind === "website") return raw.startsWith("http") ? raw : `https://${raw}`;
  if (raw.startsWith("http")) return raw;
  if (kind === "instagram") return `https://instagram.com/${raw.replace(/^@/, "")}`;
  if (kind === "twitter") return `https://x.com/${raw.replace(/^@/, "")}`;
  if (kind === "facebook") return `https://facebook.com/${raw.replace(/^@/, "")}`;
  if (kind === "linkedin") {
    return raw.includes("linkedin.com")
      ? raw.startsWith("http")
        ? raw
        : `https://${raw}`
      : `https://linkedin.com/in/${raw.replace(/^@/, "")}`;
  }
  if (kind === "youtube") {
    return raw.includes("youtube.com") || raw.includes("youtu.be")
      ? raw.startsWith("http")
        ? raw
        : `https://${raw}`
      : `https://youtube.com/@${raw.replace(/^@/, "")}`;
  }
  if (kind === "tiktok") return `https://tiktok.com/@${raw.replace(/^@/, "")}`;
  if (kind === "telegram") return `https://t.me/${raw.replace(/^@/, "")}`;
  return raw.startsWith("http") ? raw : `https://${raw}`;
}
