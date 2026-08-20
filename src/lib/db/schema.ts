import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  isGuest: boolean("is_guest").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  aiCustomTrialUsed: boolean("ai_custom_trial_used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Untitled site"),
    subdomain: text("subdomain").notNull(),
    customDomain: text("custom_domain"),
    status: text("status").notNull().default("draft"),
    templateId: text("template_id").notNull().default("classic"),
    generationMode: text("generation_mode").notNull().default("template"),
    layoutVariant: text("layout_variant").notNull().default("standard"),
    companyData: jsonb("company_data").$type<Record<string, unknown>>(),
    palette: jsonb("palette").$type<string[]>().notNull().default([]),
    logoUrl: text("logo_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    visits: integer("visits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sites_subdomain_idx").on(table.subdomain),
    uniqueIndex("sites_custom_domain_idx").on(table.customDomain),
  ],
);

export const siteContent = pgTable("site_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  contentJson: jsonb("content_json").$type<Record<string, unknown>>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  storageUrl: text("storage_url").notNull(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  parsedText: text("parsed_text"),
  parsedJson: jsonb("parsed_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageCounters = pgTable(
  "usage_counters",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    aiGenerationsUsed: integer("ai_generations_used").notNull().default(0),
    regenerationsUsed: integer("regenerations_used").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.period] })],
);

export const subscriptions = pgTable("subscriptions", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("inactive"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
});

export const generationJobs = pgTable("generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  steps: jsonb("steps")
    .$type<{ key: string; label: string; status: "pending" | "running" | "done" | "failed" }[]>()
    .notNull()
    .default([]),
  errorMessage: text("error_message"),
  notifyEmail: text("notify_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tenants: many(tenants),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(users, { fields: [tenants.ownerUserId], references: [users.id] }),
  sites: many(sites),
  uploads: many(uploads),
  subscription: one(subscriptions),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  tenant: one(tenants, { fields: [sites.tenantId], references: [tenants.id] }),
  content: many(siteContent),
}));

export const siteContentRelations = relations(siteContent, ({ one }) => ({
  site: one(sites, { fields: [siteContent.siteId], references: [sites.id] }),
}));
