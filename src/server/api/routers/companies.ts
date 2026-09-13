import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  auditLogs,
  activities,
  companies,
  contacts,
  deals,
  pipelineStages,
  quotations,
  tasks,
  teamMembers,
  users,
} from "~/server/db/schema";

const companyStatuses = [
  "prospect",
  "qualified",
  "customer",
  "inactive",
] as const;
const sortOptions = [
  "latest_activity",
  "estimated_value",
  "created_at",
] as const;

export const companiesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().trim().max(100).default(""),
        status: z.enum(companyStatuses).optional(),
        ownerId: z.string().optional(),
        sortBy: z.enum(sortOptions).default("latest_activity"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const scopedUserIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((member) => member.userId);
      const search = input.search ? `%${input.search}%` : null;
      const where = and(
        inArray(companies.ownerId, scopedUserIds),
        input.status ? eq(companies.status, input.status) : undefined,
        input.ownerId && scopedUserIds.includes(input.ownerId)
          ? eq(companies.ownerId, input.ownerId)
          : undefined,
        search
          ? or(
              ilike(companies.legalName, search),
              ilike(companies.industry, search),
              ilike(companies.city, search),
              ilike(users.name, search),
            )
          : undefined,
      );

      const rows = await ctx.db
        .select({
          id: companies.id,
          legalName: companies.legalName,
          slug: companies.slug,
          industry: companies.industry,
          companySize: companies.companySize,
          website: companies.website,
          country: companies.country,
          city: companies.city,
          status: companies.status,
          estimatedAnnualValue: companies.estimatedAnnualValue,
          notes: companies.notes,
          ownerId: companies.ownerId,
          ownerName: users.name,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
          contactsCount: sql<number>`count(distinct ${contacts.id})`,
          openDealsCount: sql<number>`count(distinct ${deals.id}) filter (where ${pipelineStages.isTerminal} = false)`,
          lastActivityDate: sql<Date | null>`max(${activities.activityAt})`,
        })
        .from(companies)
        .leftJoin(users, eq(companies.ownerId, users.id))
        .leftJoin(contacts, eq(contacts.companyId, companies.id))
        .leftJoin(deals, eq(deals.companyId, companies.id))
        .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .leftJoin(activities, eq(activities.companyId, companies.id))
        .where(where)
        .groupBy(companies.id, users.name)
        .orderBy(
          input.sortBy === "estimated_value"
            ? desc(companies.estimatedAnnualValue)
            : input.sortBy === "created_at"
              ? desc(companies.createdAt)
              : desc(sql`max(${activities.activityAt})`),
        );

      return rows.map((row) => ({
        ...row,
        contactsCount: Number(row.contactsCount),
        openDealsCount: Number(row.openDealsCount),
        estimatedAnnualValue: Number(row.estimatedAnnualValue ?? 0),
      }));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const isRep = ctx.session.user.role === "sales_rep";
      const teamUserIds = isRep
        ? [ctx.session.user.id]
        : (
            await ctx.db
              .select({ userId: teamMembers.userId })
              .from(teamMembers)
              .where(eq(teamMembers.teamId, ctx.session.user.teamId))
          ).map((member) => member.userId);
      const [company] = await ctx.db
        .select({
          id: companies.id,
          legalName: companies.legalName,
          slug: companies.slug,
          industry: companies.industry,
          companySize: companies.companySize,
          website: companies.website,
          country: companies.country,
          city: companies.city,
          address: companies.address,
          taxVatNumber: companies.taxVatNumber,
          status: companies.status,
          estimatedAnnualValue: companies.estimatedAnnualValue,
          notes: companies.notes,
          ownerId: companies.ownerId,
          ownerName: users.name,
        })
        .from(companies)
        .leftJoin(users, eq(companies.ownerId, users.id))
        .where(
          and(
            eq(companies.id, input.id),
            inArray(companies.ownerId, teamUserIds),
          ),
        )
        .limit(1);

      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const [
        companyContacts,
        activeDeals,
        openTasks,
        companyQuotations,
        recentActivities,
      ] = await Promise.all([
        ctx.db
          .select()
          .from(contacts)
          .where(eq(contacts.companyId, input.id))
          .orderBy(desc(contacts.createdAt)),
        ctx.db
          .select({
            id: deals.id,
            name: deals.name,
            amount: deals.amount,
            probability: deals.probability,
            expectedCloseDate: deals.expectedCloseDate,
            stageName: pipelineStages.name,
            stageColor: pipelineStages.color,
          })
          .from(deals)
          .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
          .where(
            and(
              eq(deals.companyId, input.id),
              eq(pipelineStages.isTerminal, false),
            ),
          )
          .orderBy(desc(deals.updatedAt)),
        ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueAt: tasks.dueAt,
            priority: tasks.priority,
            status: tasks.status,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.companyId, input.id),
              inArray(tasks.status, ["open", "in_progress"]),
            ),
          )
          .orderBy(tasks.dueAt),
        ctx.db
          .select({
            id: quotations.id,
            quoteNumber: quotations.quoteNumber,
            status: quotations.status,
            total: quotations.total,
            validUntil: quotations.validUntil,
          })
          .from(quotations)
          .where(eq(quotations.companyId, input.id))
          .orderBy(desc(quotations.createdAt)),
        ctx.db
          .select({
            id: activities.id,
            type: activities.type,
            subject: activities.subject,
            body: activities.body,
            activityAt: activities.activityAt,
            status: activities.status,
            creatorName: users.name,
          })
          .from(activities)
          .leftJoin(users, eq(activities.createdById, users.id))
          .where(eq(activities.companyId, input.id))
          .orderBy(desc(activities.activityAt))
          .limit(20),
      ]);

      return {
        ...company,
        estimatedAnnualValue: Number(company.estimatedAnnualValue ?? 0),
        contacts: companyContacts,
        activeDeals: activeDeals.map((deal) => ({
          ...deal,
          amount: Number(deal.amount),
        })),
        openTasks,
        quotations: companyQuotations.map((quote) => ({
          ...quote,
          total: Number(quote.total),
        })),
        activities: recentActivities,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Company name is required").max(255),
        website: z
          .string()
          .trim()
          .url("Enter a valid URL")
          .max(500)
          .optional()
          .or(z.literal("")),
        country: z.string().trim().max(100).optional(),
        city: z.string().trim().max(100).optional(),
        industry: z.string().trim().max(255).optional(),
        size: z.string().trim().max(100).optional(),
        status: z.enum(companyStatuses),
        estimatedAnnualValue: z.number().min(0, "Value cannot be negative"),
        taxNumber: z.string().trim().max(100).optional(),
        notes: z
          .string()
          .trim()
          .max(2000, "Notes must be 2,000 characters or fewer")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slugBase = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = `${slugBase}-${Date.now().toString(36)}`;
      const [company] = await ctx.db
        .insert(companies)
        .values({
          legalName: input.name,
          slug,
          website: input.website || null,
          country: input.country || null,
          city: input.city || null,
          industry: input.industry || null,
          companySize: input.size || null,
          status: input.status,
          estimatedAnnualValue: input.estimatedAnnualValue.toFixed(2),
          taxVatNumber: input.taxNumber || null,
          notes: input.notes || null,
          ownerId: ctx.session.user.id,
        })
        .returning();

      await ctx.db.insert(auditLogs).values({
        actorId: ctx.session.user.id,
        action: "company_created",
        entityType: "company",
        entityId: String(company!.id),
        metadata: { event: "company.created", demo: false },
      });

      return company;
    }),
});
