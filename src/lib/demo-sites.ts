import { DEMO_SUBDOMAINS } from "./host";
import type { SiteRenderModel } from "@/types/content";

export const DEMO_SITES: Record<(typeof DEMO_SUBDOMAINS)[number], SiteRenderModel> = {
  "hale-whitmore": {
    name: "Hale & Whitmore",
    subdomain: "hale-whitmore",
    logoUrl: null,
    templateId: "classic",
    layoutVariant: "standard",
    brandColor: "#3D2B1F",
    palette: ["#3D2B1F", "#C4A574", "#F7F3EC"],
    hideBadge: true,
    company: {
      name: "Hale & Whitmore",
      tagline: "Counsel for closely held companies.",
      industry: "Law",
      description:
        "A boutique corporate and disputes practice for founders, family businesses, and independent operators who want senior attention without a 400-lawyer letterhead.",
      services: [
        { title: "Corporate counsel", description: "Entity work, shareholder agreements, and day-to-day advice." },
        { title: "Commercial disputes", description: "Contract fights resolved with as little theatre as possible." },
        { title: "Succession", description: "Ownership transitions planned before they become emergencies." },
      ],
      products: [],
      contact: {
        email: "hello@hale-whitmore.example",
        phone: "+1 (415) 555-0142",
        address: "Two Embarcadero Center, San Francisco",
        website: "",
        whatsapp: "",
      },
      social: {
        linkedin: "",
        twitter: "",
        facebook: "",
        instagram: "",
        youtube: "",
        tiktok: "",
        telegram: "",
        whatsapp: "",
      },
      media: [],
      brandColor: "#3D2B1F",
      palette: ["#3D2B1F", "#C4A574"],
      tone: "formal",
      uncertainFields: [],
    },
    content: {
      hero: {
        headline: "Counsel for closely held companies.",
        subheadline:
          "Hale & Whitmore is a boutique corporate and disputes practice. You work with the partners whose names are on the door.",
        ctaLabel: "Request a consultation",
        ctaHref: "#contact",
      },
      about: {
        title: "A smaller firm, on purpose",
        body: "We represent founders, family companies, and independent operators. The work is unglamorous and high-stakes: documents that have to hold, disputes that should not become folklore, and ownership that needs a next chapter.",
      },
      services: {
        title: "How we work",
        items: [
          { title: "Corporate counsel", description: "Entity work, shareholder agreements, and day-to-day advice." },
          { title: "Commercial disputes", description: "Contract fights resolved with as little theatre as possible." },
          { title: "Succession", description: "Ownership transitions planned before they become emergencies." },
        ],
      },
      testimonials: {
        title: "From the people who hire us",
        items: [
          {
            quote: "They write like humans and negotiate like adults. That combination is rarer than it should be.",
            author: "Elena Voss",
            role: "CEO, North Range Co.",
          },
        ],
      },
      cta: {
        headline: "If the matter is real, call.",
        body: "We do not take every brief. If we cannot help, we will say so quickly.",
        buttonLabel: "Request a consultation",
      },
      contact: {
        title: "Contact",
        body: "Partners review every enquiry.",
        email: "hello@hale-whitmore.example",
        phone: "+1 (415) 555-0142",
        address: "Two Embarcadero Center, San Francisco",
        whatsapp: "",
      },
      footer: { blurb: "Hale & Whitmore — corporate counsel and commercial disputes." },
    },
    sectionOrder: ["hero", "about", "services", "testimonials", "cta", "contact", "footer"],
  },
  "oak-ember": {
    name: "Oak & Ember",
    subdomain: "oak-ember",
    logoUrl: null,
    templateId: "editorial",
    layoutVariant: "stacked",
    brandColor: "#8B3A2A",
    palette: ["#8B3A2A", "#E8C9A8", "#FBF6EE"],
    hideBadge: true,
    company: {
      name: "Oak & Ember Bakery",
      tagline: "Bread, pastry, and a table by the window.",
      industry: "Bakery",
      description:
        "A neighbourhood bakery in Portland baking naturally leavened bread, seasonal pastry, and lunch that does not feel like an afterthought.",
      services: [
        { title: "Daily bread", description: "Country loaves, rye, and focaccia off the stone deck." },
        { title: "Pastry case", description: "Morning buns, fruit tarts, and whatever the fruit crate allows." },
        { title: "Catering", description: "Sandwich platters and cake orders with 48 hours' notice." },
      ],
      products: [],
      contact: {
        email: "oven@oakember.example",
        phone: "+1 (503) 555-0199",
        address: "412 Division St, Portland",
        website: "",
        whatsapp: "",
      },
      social: {
        linkedin: "",
        twitter: "",
        facebook: "",
        instagram: "oakandember",
        youtube: "",
        tiktok: "",
        telegram: "",
        whatsapp: "",
      },
      media: [],
      brandColor: "#8B3A2A",
      palette: ["#8B3A2A"],
      tone: "friendly",
      uncertainFields: [],
    },
    content: {
      hero: {
        headline: "Bread, pastry, and a table by the window.",
        subheadline: "Oak & Ember is a neighbourhood bakery. We open when the loaves come out — usually 7:30.",
        ctaLabel: "See today's hours",
        ctaHref: "#contact",
      },
      about: {
        title: "Baked in the same room you eat in",
        body: "We mill some of the wheat, ferment the rest overnight, and keep the case small on purpose. If a fruit is not in season, it is not in the tart.",
      },
      services: {
        title: "From the oven",
        items: [
          { title: "Daily bread", description: "Country loaves, rye, and focaccia off the stone deck." },
          { title: "Pastry case", description: "Morning buns, fruit tarts, and whatever the fruit crate allows." },
          { title: "Catering", description: "Sandwich platters and cake orders with 48 hours' notice." },
        ],
      },
      testimonials: {
        title: "Regulars",
        items: [
          {
            quote: "The rye is the reason I moved three blocks closer. That is not a joke.",
            author: "Marcus L.",
            role: "Tuesday morning, always",
          },
        ],
      },
      cta: {
        headline: "Come in before we sell out the focaccia.",
        body: "We do. Most Saturdays, by 11.",
        buttonLabel: "Get directions",
      },
      contact: {
        title: "Find us",
        body: "Tue–Sun, 7:30–3. Closed Mondays for the starter.",
        email: "oven@oakember.example",
        phone: "+1 (503) 555-0199",
        address: "412 Division St, Portland",
        whatsapp: "",
      },
      footer: { blurb: "Oak & Ember — bread and pastry in Portland." },
    },
    sectionOrder: ["hero", "about", "services", "testimonials", "cta", "contact", "footer"],
  },
  northline: {
    name: "Northline Analytics",
    subdomain: "northline",
    logoUrl: null,
    templateId: "modern",
    layoutVariant: "split",
    brandColor: "#0F4C4C",
    palette: ["#0F4C4C", "#1FA6A6", "#F4F7F6"],
    hideBadge: true,
    company: {
      name: "Northline Analytics",
      tagline: "Operational reporting that operators will actually open.",
      industry: "Analytics",
      description:
        "Northline builds decision dashboards and weekly operating reviews for mid-market teams tired of a data pile nobody trusts.",
      services: [
        { title: "Operating reviews", description: "A weekly pack your leadership team can run a meeting from." },
        { title: "Dashboard rebuilds", description: "Replace the 40-tile graveyard with eight numbers that matter." },
        { title: "Metric definitions", description: "One source of truth for revenue, margin, and pipeline." },
      ],
      products: [],
      contact: {
        email: "work@northline.example",
        phone: "+1 (646) 555-0177",
        address: "Remote-first, New York hours",
        website: "",
        whatsapp: "",
      },
      social: {
        linkedin: "northline-analytics",
        twitter: "",
        facebook: "",
        instagram: "",
        youtube: "",
        tiktok: "",
        telegram: "",
        whatsapp: "",
      },
      media: [],
      brandColor: "#0F4C4C",
      palette: ["#0F4C4C"],
      tone: "technical",
      uncertainFields: [],
    },
    content: {
      hero: {
        headline: "Operational reporting that operators will actually open.",
        subheadline:
          "Northline rebuilds the weekly numbers for mid-market teams. Fewer tiles. Clearer definitions. A meeting that ends on time.",
        ctaLabel: "Book a working session",
        ctaHref: "#contact",
      },
      about: {
        title: "We are not a BI theme park",
        body: "Most reporting stacks fail because nobody agreed what a number means. We start with definitions, then build the smallest dashboard that can run an operating review.",
      },
      services: {
        title: "Engagements",
        items: [
          { title: "Operating reviews", description: "A weekly pack your leadership team can run a meeting from." },
          { title: "Dashboard rebuilds", description: "Replace the 40-tile graveyard with eight numbers that matter." },
          { title: "Metric definitions", description: "One source of truth for revenue, margin, and pipeline." },
        ],
      },
      testimonials: {
        title: "After the rebuild",
        items: [
          {
            quote: "We stopped arguing about whose export was right. The meeting got twenty minutes shorter.",
            author: "Priya Shah",
            role: "COO, Helix Freight",
          },
        ],
      },
      cta: {
        headline: "Bring us the messiest weekly pack you have.",
        body: "If we cannot find a simpler version in the first session, we will say so.",
        buttonLabel: "Book a working session",
      },
      contact: {
        title: "Start a conversation",
        body: "Serious enquiries only — we take a limited number of rebuilds each quarter.",
        email: "work@northline.example",
        phone: "+1 (646) 555-0177",
        address: "Remote-first, New York hours",
        whatsapp: "",
      },
      footer: { blurb: "Northline Analytics — operating reviews without the dashboard sprawl." },
    },
    sectionOrder: ["hero", "about", "services", "testimonials", "cta", "contact", "footer"],
  },
};

export function getDemoSite(subdomain: string) {
  return DEMO_SITES[subdomain as keyof typeof DEMO_SITES] ?? null;
}
