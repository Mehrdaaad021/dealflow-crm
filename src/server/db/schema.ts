import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `dealflow_${name}`);

export const userRoleEnum = pgEnum("dealflow_user_role", [
  "sales_rep",
  "sales_manager",
  "admin",
]);
export const companyStatusEnum = pgEnum("dealflow_company_status", [
  "prospect",
  "qualified",
  "customer",
  "inactive",
]);
export const contactStatusEnum = pgEnum("dealflow_contact_status", [
  "active",
  "inactive",
]);
export const communicationChannelEnum = pgEnum(
  "dealflow_communication_channel",
  ["email", "phone", "whatsapp", "sms", "other"],
);
export const leadSourceEnum = pgEnum("dealflow_lead_source", [
  "website",
  "referral",
  "event",
  "outbound",
  "partner",
  "other",
]);
export const leadStatusEnum = pgEnum("dealflow_lead_status", [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
]);
export const activityTypeEnum = pgEnum("dealflow_activity_type", [
  "call",
  "meeting",
  "email",
  "messaging",
  "note",
  "demo",
  "quotation_sent",
  "status_change",
]);
export const activityStatusEnum = pgEnum("dealflow_activity_status", [
  "pending",
  "completed",
]);
export const taskPriorityEnum = pgEnum("dealflow_task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const taskStatusEnum = pgEnum("dealflow_task_status", [
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
export const productStatusEnum = pgEnum("dealflow_product_status", [
  "active",
  "inactive",
]);
export const quoteStatusEnum = pgEnum("dealflow_quote_status", [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
]);
export const currencyEnum = pgEnum("dealflow_currency", ["AED"]);
export const auditEntityTypeEnum = pgEnum("dealflow_audit_entity_type", [
  "deal",
  "lead",
  "quote",
  "company",
  "user",
  "product",
  "permission",
]);
export const auditActionEnum = pgEnum("dealflow_audit_action", [
  "company_created",
  "lead_converted",
  "stage_changed",
  "owner_changed",
  "quote_approved",
  "quote_rejected",
  "quote_status_changed",
  "company_archived",
  "company_deleted",
  "permissions_changed",
  "product_price_changed",
]);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
  hashedPassword: d.text(),
  role: userRoleEnum("role").default("sales_rep").notNull(),
  active: d.boolean().default(true).notNull(),
  lastActivityAt: d.timestamp({ withTimezone: true }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  teamMembers: many(teamMembers),
  ownedCompanies: many(companies),
  ownedContacts: many(contacts),
  ownedLeads: many(leads),
  ownedDeals: many(deals),
  createdActivities: many(activities),
  assignedTasks: many(tasks),
  ownedQuotations: many(quotations),
  auditLogs: many(auditLogs),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const teams = createTable(
  "team",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 255 }).notNull(),
    description: d.text(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [uniqueIndex("team_name_idx").on(t.name)],
);

export const teamMembers = createTable(
  "team_member",
  (d) => ({
    teamId: d
      .integer()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index("team_member_user_id_idx").on(t.userId),
  ],
);

export const companies = createTable(
  "company",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    legalName: d.varchar({ length: 255 }).notNull(),
    slug: d.varchar({ length: 255 }).notNull(),
    industry: d.varchar({ length: 255 }),
    companySize: d.varchar({ length: 100 }),
    website: d.varchar({ length: 500 }),
    country: d.varchar({ length: 100 }),
    city: d.varchar({ length: 100 }),
    address: d.text(),
    taxVatNumber: d.varchar({ length: 100 }),
    ownerId: d.varchar({ length: 255 }).references(() => users.id),
    status: companyStatusEnum("status").default("prospect").notNull(),
    estimatedAnnualValue: d.numeric({ precision: 14, scale: 2 }),
    notes: d.text(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("company_slug_idx").on(t.slug),
    index("company_owner_id_idx").on(t.ownerId),
  ],
);

export const contacts = createTable(
  "contact",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    companyId: d
      .integer()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    firstName: d.varchar({ length: 100 }).notNull(),
    lastName: d.varchar({ length: 100 }).notNull(),
    jobTitle: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }),
    phone: d.varchar({ length: 50 }),
    preferredCommunicationChannel: communicationChannelEnum(
      "preferred_communication_channel",
    ),
    isDecisionMaker: d.boolean().default(false).notNull(),
    status: contactStatusEnum("status").default("active").notNull(),
    notes: d.text(),
    ownerId: d.varchar({ length: 255 }).references(() => users.id),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("contact_company_id_idx").on(t.companyId),
    index("contact_owner_id_idx").on(t.ownerId),
  ],
);

export const leads = createTable(
  "lead",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 255 }).notNull(),
    companyId: d
      .integer()
      .references(() => companies.id, { onDelete: "set null" }),
    contactId: d
      .integer()
      .references(() => contacts.id, { onDelete: "set null" }),
    source: leadSourceEnum("source").notNull(),
    status: leadStatusEnum("status").default("new").notNull(),
    score: d.integer(),
    estimatedValue: d.numeric({ precision: 14, scale: 2 }),
    ownerId: d.varchar({ length: 255 }).references(() => users.id),
    nextFollowUpAt: d.timestamp({ withTimezone: true }),
    notes: d.text(),
    convertedAt: d.timestamp({ withTimezone: true }),
    conversionMetadata: d.jsonb(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("lead_company_id_idx").on(t.companyId),
    index("lead_owner_id_idx").on(t.ownerId),
  ],
);

export const pipelines = createTable("pipeline", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  name: d.varchar({ length: 255 }).notNull(),
  description: d.text(),
  createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}));

export const pipelineStages = createTable(
  "pipeline_stage",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    pipelineId: d
      .integer()
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: d.varchar({ length: 255 }).notNull(),
    position: d.integer().notNull(),
    color: d.varchar({ length: 30 }),
    probabilityDefault: d.integer().notNull().default(0),
    isTerminal: d.boolean().default(false).notNull(),
    active: d.boolean().default(true).notNull(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("pipeline_stage_pipeline_id_idx").on(t.pipelineId)],
);

export const deals = createTable(
  "deal",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 255 }).notNull(),
    companyId: d
      .integer()
      .notNull()
      .references(() => companies.id),
    primaryContactId: d
      .integer()
      .references(() => contacts.id, { onDelete: "set null" }),
    ownerId: d.varchar({ length: 255 }).references(() => users.id),
    pipelineId: d
      .integer()
      .references(() => pipelines.id, { onDelete: "set null" }),
    stageId: d
      .integer()
      .references(() => pipelineStages.id, { onDelete: "set null" }),
    amount: d.numeric({ precision: 14, scale: 2 }).notNull(),
    probability: d.integer().notNull().default(0),
    expectedCloseDate: d.date(),
    sourceLeadId: d
      .integer()
      .references(() => leads.id, { onDelete: "set null" }),
    description: d.text(),
    lostReason: d.text(),
    wonLostAt: d.timestamp({ withTimezone: true }),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("deal_company_id_idx").on(t.companyId),
    index("deal_owner_id_idx").on(t.ownerId),
    index("deal_pipeline_id_idx").on(t.pipelineId),
    index("deal_stage_id_idx").on(t.stageId),
  ],
);

export const activities = createTable(
  "activity",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    companyId: d
      .integer()
      .references(() => companies.id, { onDelete: "set null" }),
    contactId: d
      .integer()
      .references(() => contacts.id, { onDelete: "set null" }),
    dealId: d.integer().references(() => deals.id, { onDelete: "set null" }),
    type: activityTypeEnum("type").notNull(),
    subject: d.varchar({ length: 255 }).notNull(),
    body: d.text(),
    activityAt: d.timestamp({ withTimezone: true }).notNull(),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    status: activityStatusEnum("status").default("completed").notNull(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("activity_company_id_idx").on(t.companyId),
    index("activity_deal_id_idx").on(t.dealId),
    index("activity_created_by_id_idx").on(t.createdById),
  ],
);

export const tasks = createTable(
  "task",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    title: d.varchar({ length: 255 }).notNull(),
    companyId: d
      .integer()
      .references(() => companies.id, { onDelete: "set null" }),
    contactId: d
      .integer()
      .references(() => contacts.id, { onDelete: "set null" }),
    leadId: d.integer().references(() => leads.id, { onDelete: "set null" }),
    dealId: d.integer().references(() => deals.id, { onDelete: "set null" }),
    assignedToId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    dueAt: d.timestamp({ withTimezone: true }),
    priority: taskPriorityEnum("priority").default("medium").notNull(),
    status: taskStatusEnum("status").default("open").notNull(),
    reminder: d.boolean().default(false).notNull(),
    notes: d.text(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("task_company_id_idx").on(t.companyId),
    index("task_deal_id_idx").on(t.dealId),
    index("task_assigned_to_id_idx").on(t.assignedToId),
  ],
);

export const products = createTable(
  "product",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 255 }).notNull(),
    sku: d.varchar({ length: 100 }).notNull(),
    description: d.text(),
    unit: d.varchar({ length: 50 }).notNull(),
    unitPrice: d.numeric({ precision: 14, scale: 2 }).notNull(),
    taxRate: d.numeric({ precision: 5, scale: 2 }).notNull(),
    status: productStatusEnum("status").default("active").notNull(),
    category: d.varchar({ length: 100 }),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [uniqueIndex("product_sku_idx").on(t.sku)],
);

export const quotations = createTable(
  "quotation",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    quoteNumber: d.varchar({ length: 100 }).notNull(),
    companyId: d
      .integer()
      .notNull()
      .references(() => companies.id),
    contactId: d
      .integer()
      .references(() => contacts.id, { onDelete: "set null" }),
    dealId: d.integer().references(() => deals.id, { onDelete: "set null" }),
    ownerId: d.varchar({ length: 255 }).references(() => users.id),
    status: quoteStatusEnum("status").default("draft").notNull(),
    currency: currencyEnum("currency").default("AED").notNull(),
    validUntil: d.date(),
    subtotal: d.numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    discount: d.numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    tax: d.numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    total: d.numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    customerNotes: d.text(),
    internalNotes: d.text(),
    sentAt: d.timestamp({ withTimezone: true }),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("quotation_quote_number_idx").on(t.quoteNumber),
    index("quotation_company_id_idx").on(t.companyId),
    index("quotation_deal_id_idx").on(t.dealId),
    index("quotation_owner_id_idx").on(t.ownerId),
  ],
);

export const quotationLineItems = createTable(
  "quotation_line_item",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    quotationId: d
      .integer()
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    productId: d
      .integer()
      .references(() => products.id, { onDelete: "set null" }),
    description: d.text().notNull(),
    sku: d.varchar({ length: 100 }),
    quantity: d.numeric({ precision: 14, scale: 3 }).notNull(),
    unitPrice: d.numeric({ precision: 14, scale: 2 }).notNull(),
    discount: d.numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    taxRate: d.numeric({ precision: 5, scale: 2 }).notNull(),
    lineSubtotal: d.numeric({ precision: 14, scale: 2 }).notNull(),
    lineTotal: d.numeric({ precision: 14, scale: 2 }).notNull(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("quotation_line_item_quotation_id_idx").on(t.quotationId)],
);

export const auditLogs = createTable(
  "audit_log",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    actorId: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    entityType: auditEntityTypeEnum("entity_type").notNull(),
    entityId: d.varchar({ length: 255 }).notNull(),
    metadata: d.jsonb(),
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [
    index("audit_log_actor_id_idx").on(t.actorId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const teamRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
}));

export const teamMemberRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const companyRelations = relations(companies, ({ one, many }) => ({
  owner: one(users, { fields: [companies.ownerId], references: [users.id] }),
  contacts: many(contacts),
  leads: many(leads),
  deals: many(deals),
  activities: many(activities),
  tasks: many(tasks),
  quotations: many(quotations),
}));

export const contactRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  owner: one(users, { fields: [contacts.ownerId], references: [users.id] }),
  leads: many(leads),
  deals: many(deals),
  activities: many(activities),
  tasks: many(tasks),
  quotations: many(quotations),
}));

export const leadRelations = relations(leads, ({ one, many }) => ({
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
  }),
  owner: one(users, { fields: [leads.ownerId], references: [users.id] }),
  sourceDeal: many(deals),
  tasks: many(tasks),
}));

export const pipelineRelations = relations(pipelines, ({ many }) => ({
  stages: many(pipelineStages),
  deals: many(deals),
}));

export const pipelineStageRelations = relations(
  pipelineStages,
  ({ one, many }) => ({
    pipeline: one(pipelines, {
      fields: [pipelineStages.pipelineId],
      references: [pipelines.id],
    }),
    deals: many(deals),
  }),
);

export const dealRelations = relations(deals, ({ one, many }) => ({
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  primaryContact: one(contacts, {
    fields: [deals.primaryContactId],
    references: [contacts.id],
  }),
  owner: one(users, { fields: [deals.ownerId], references: [users.id] }),
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.stageId],
    references: [pipelineStages.id],
  }),
  sourceLead: one(leads, {
    fields: [deals.sourceLeadId],
    references: [leads.id],
  }),
  activities: many(activities),
  tasks: many(tasks),
  quotations: many(quotations),
}));

export const activityRelations = relations(activities, ({ one }) => ({
  company: one(companies, {
    fields: [activities.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, { fields: [activities.dealId], references: [deals.id] }),
  createdBy: one(users, {
    fields: [activities.createdById],
    references: [users.id],
  }),
}));

export const taskRelations = relations(tasks, ({ one }) => ({
  company: one(companies, {
    fields: [tasks.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [tasks.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
  deal: one(deals, { fields: [tasks.dealId], references: [deals.id] }),
  assignedTo: one(users, {
    fields: [tasks.assignedToId],
    references: [users.id],
  }),
}));

export const productRelations = relations(products, ({ many }) => ({
  quotationLineItems: many(quotationLineItems),
}));

export const quotationRelations = relations(quotations, ({ one, many }) => ({
  company: one(companies, {
    fields: [quotations.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [quotations.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, { fields: [quotations.dealId], references: [deals.id] }),
  owner: one(users, { fields: [quotations.ownerId], references: [users.id] }),
  lineItems: many(quotationLineItems),
}));

export const quotationLineItemRelations = relations(
  quotationLineItems,
  ({ one }) => ({
    quotation: one(quotations, {
      fields: [quotationLineItems.quotationId],
      references: [quotations.id],
    }),
    product: one(products, {
      fields: [quotationLineItems.productId],
      references: [products.id],
    }),
  }),
);

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));
