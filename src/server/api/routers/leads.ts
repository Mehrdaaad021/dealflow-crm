import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  auditLogs,
  companies,
  deals,
  leads,
  contacts,
  pipelineStages,
  pipelines,
  teamMembers,
  users,
} from "~/server/db/schema";

const leadStatuses = ["new", "contacted", "qualified", "unqualified", "converted"] as const;
const leadSources = ["website", "referral", "event", "outbound", "partner", "other"] as const;
const sortOptions = ["score", "next_follow_up", "created_at"] as const;

async function scopedOwnerIds(ctx: any) {
  if (ctx.session.user.role === "sales_rep") return [ctx.session.user.id];
  const members = await ctx.db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, ctx.session.user.teamId));
  return members.map((member: { userId: string }) => member.userId);
}

const leadCreateInput = z.object({
  name: z.string().trim().min(1, "Lead name is required").max(255),
  companyId: z.number().int().positive().optional(),
  source: z.enum(leadSources),
  score: z.number().int().min(0).max(100),
  estimatedValue: z.number().min(0),
  nextFollowUpAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const leadsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(leadStatuses).optional(),
        source: z.enum(leadSources).optional(),
        ownerId: z.string().optional(),
        search: z.string().trim().max(100).default(""),
        sortBy: z.enum(sortOptions).default("score"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ownerIds = await scopedOwnerIds(ctx);
      const search = input.search ? `%${input.search}%` : undefined;
      const rows = await ctx.db
        .select({
          id: leads.id,
          name: leads.name,
          companyId: leads.companyId,
          companyName: companies.legalName,
          ownerId: leads.ownerId,
          ownerName: users.name,
          source: leads.source,
          score: leads.score,
          estimatedValue: leads.estimatedValue,
          nextFollowUpAt: leads.nextFollowUpAt,
          status: leads.status,
          notes: leads.notes,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .leftJoin(companies, eq(leads.companyId, companies.id))
        .leftJoin(users, eq(leads.ownerId, users.id))
        .where(
          and(
            inArray(leads.ownerId, ownerIds),
            input.status ? eq(leads.status, input.status) : undefined,
            input.source ? eq(leads.source, input.source) : undefined,
            input.ownerId && ownerIds.includes(input.ownerId)
              ? eq(leads.ownerId, input.ownerId)
              : undefined,
            search ? or(ilike(leads.name, search), ilike(companies.legalName, search)) : undefined,
          ),
        )
        .orderBy(
          input.sortBy === "next_follow_up"
            ? asc(leads.nextFollowUpAt)
            : input.sortBy === "created_at"
              ? desc(leads.createdAt)
              : desc(leads.score),
        );
      return rows.map((row) => ({
        ...row,
        score: row.score ?? 0,
        estimatedValue: Number(row.estimatedValue ?? 0),
      }));
    }),

  create: protectedProcedure.input(leadCreateInput).mutation(async ({ ctx, input }) => {
    if (input.companyId) {
      const ownerIds = await scopedOwnerIds(ctx);
      const [company] = await ctx.db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, input.companyId), inArray(companies.ownerId, ownerIds)))
        .limit(1);
      if (!company) throw new TRPCError({ code: "FORBIDDEN" });
    }
    const [lead] = await ctx.db
      .insert(leads)
      .values({
        name: input.name,
        companyId: input.companyId ?? null,
        source: input.source,
        score: input.score,
        estimatedValue: input.estimatedValue.toFixed(2),
        ownerId: ctx.session.user.id,
        nextFollowUpAt: input.nextFollowUpAt ?? null,
        notes: input.notes || null,
      })
      .returning();
    return lead;
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(leadStatuses) }))
    .mutation(async ({ ctx, input }) => {
      const ownerIds = await scopedOwnerIds(ctx);
      const [lead] = await ctx.db
        .select({ id: leads.id, status: leads.status })
        .from(leads)
        .where(and(eq(leads.id, input.id), inArray(leads.ownerId, ownerIds)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      const allowed: Record<string, string[]> = {
        new: ["contacted", "unqualified"],
        contacted: ["qualified", "unqualified"],
        qualified: ["qualified", "unqualified"],
        unqualified: ["unqualified"],
        converted: ["converted"],
      };
      if (!allowed[lead.status]?.includes(input.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid lead status transition" });
      }
      const [updated] = await ctx.db
        .update(leads)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();
      return updated;
    }),

  convert: protectedProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        mode: z.enum(["use_existing", "create_new"]),
        existingCompanyId: z.number().int().positive().optional(),
        newCompany: z
          .object({
            name: z.string().trim().min(1).max(255),
            industry: z.string().trim().max(255).optional(),
            country: z.string().trim().max(100).optional(),
            city: z.string().trim().max(100).optional(),
          })
          .optional(),
        contactId: z.number().int().positive().optional(),
        dealName: z.string().trim().min(1).max(255),
        amount: z.number().min(0),
        stageId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ownerIds = await scopedOwnerIds(ctx);
      const [lead] = await ctx.db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), inArray(leads.ownerId, ownerIds)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      if (lead.status !== "qualified") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only qualified leads can be converted" });
      }

      let companyId = input.existingCompanyId;
      if (input.mode === "use_existing") {
        if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an existing company" });
        const [company] = await ctx.db
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, companyId), inArray(companies.ownerId, ownerIds)))
          .limit(1);
        if (!company) throw new TRPCError({ code: "FORBIDDEN" });
      } else {
        if (!input.newCompany) throw new TRPCError({ code: "BAD_REQUEST", message: "New company details are required" });
        const slug = `${input.newCompany.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
        const [company] = await ctx.db
          .insert(companies)
          .values({ ...input.newCompany, legalName: input.newCompany.name, slug, ownerId: ctx.session.user.id })
          .returning({ id: companies.id });
        companyId = company!.id;
      }

      if (input.contactId) {
        const [contact] = await ctx.db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.id, input.contactId), eq(contacts.companyId, companyId)))
          .limit(1);
        if (!contact) throw new TRPCError({ code: "BAD_REQUEST", message: "Contact does not belong to the chosen company" });
      }

      const [pipeline] = await ctx.db.select({ id: pipelines.id }).from(pipelines).orderBy(asc(pipelines.id)).limit(1);
      if (!pipeline) throw new TRPCError({ code: "BAD_REQUEST", message: "No pipeline configured" });
      const [stage] = await ctx.db
        .select({ id: pipelineStages.id, probabilityDefault: pipelineStages.probabilityDefault })
        .from(pipelineStages)
        .where(input.stageId ? and(eq(pipelineStages.id, input.stageId), eq(pipelineStages.pipelineId, pipeline.id)) : eq(pipelineStages.pipelineId, pipeline.id))
        .orderBy(asc(pipelineStages.position))
        .limit(1);
      if (!stage) throw new TRPCError({ code: "BAD_REQUEST", message: "No pipeline stage configured" });

      const [deal] = await ctx.db
        .insert(deals)
        .values({
          name: input.dealName,
          companyId: companyId!,
          primaryContactId: input.contactId ?? lead.contactId,
          ownerId: ctx.session.user.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          amount: input.amount.toFixed(2),
          probability: stage.probabilityDefault,
          sourceLeadId: lead.id,
          description: "Converted from lead.",
        })
        .returning();
      await ctx.db
        .update(leads)
        .set({
          status: "converted",
          convertedAt: new Date(),
          conversionMetadata: { convertedDealId: deal!.id, convertedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
      await ctx.db.insert(auditLogs).values({
        actorId: ctx.session.user.id,
        action: "lead_converted",
        entityType: "lead",
        entityId: String(lead.id),
        metadata: { event: "lead.converted", convertedDealId: deal!.id, companyId },
      });
      return { deal, companyId };
    }),
});
