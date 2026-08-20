import { z } from "zod";

export const toneSchema = z.enum(["formal", "friendly", "technical"]);
export type Tone = z.infer<typeof toneSchema>;

export const offeringSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
});

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
  }),
  social: z.object({
    linkedin: z.string().default(""),
    twitter: z.string().default(""),
    facebook: z.string().default(""),
    instagram: z.string().default(""),
  }),
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
});

export const footerContentSchema = z.object({
  blurb: z.string().default(""),
});

export const sectionSchemas = {
  hero: heroContentSchema,
  about: aboutContentSchema,
  services: listSectionSchema,
  products: listSectionSchema,
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
