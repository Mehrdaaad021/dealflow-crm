import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  activities,
  auditLogs,
  companies,
  contacts,
  deals,
  pipelineStages,
  pipelines,
  tasks,
  teamMembers,
  users,
} from "~/server/db/schema";

export const dealsRouter = createTRPCRouter({
  /** Pipeline stages in order (for the Kanban board). */
  stages: protectedProcedure.query(async ({ ctx }) => {
    const [pipeline] = await ctx.db
      .select({ id: pipelines.id })
      .from(pipelines)
      .orderBy(asc(pipelines.id))
      .limit(1);
    if (!pipeline) return [];
    return ctx.db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipeline.id))
      .orderBy(asc(pipelineStages.position));
  }),

  /** All deals visible to the current user, with stage/company/owner info. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const allowedOwnerIds =
      ctx.session.user.role === "sales_rep"
        ? [ctx.session.user.id]
        : (
            await ctx.db
              .select({ userId: teamMembers.userId })
              .from(teamMembers)
              .where(eq(teamMembers.teamId, ctx.session.user.teamId))
          ).map((m) => m.userId);

    return ctx.db
      .select({
        id: deals.id,
        name: deals.name,
        amount: deals.amount,
        probability: deals.probability,
        expectedCloseDate: deals.expectedCloseDate,
        lostReason: deals.lostReason,
        wonLostAt: deals.wonLostAt,
        stageId: deals.stageId,
        companyId: deals.companyId,
        companyName: companies.legalName,
        ownerId: deals.ownerId,
        ownerName: users.name,
        ownerEmail: users.email,
        stageName: pipelineStages.name,
        stageColor: pipelineStages.color,
        overdueTasks: sql<number>`(
          select count(*)::int
          from ${tasks} t
          where t."dealId" = ${deals.id}
            and t."status" in ('open', 'in_progress')
            and t."dueAt" < now()
        )`.as("overdue_tasks"),
        nextTaskDueAt: sql<Date | null>`(
          select min(t."dueAt")
          from ${tasks} t
          where t."dealId" = ${deals.id}
            and t."status" in ('open', 'in_progress')
        )`.as("next_task_due_at"),
        createdAt: deals.createdAt,
      })
      .from(deals)
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(inArray(deals.ownerId, allowedOwnerIds))
      .orderBy(desc(deals.createdAt));
  }),

  /** Deal with related names for the detail page. */
  detail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [row] = await ctx.db
        .select({
          id: deals.id,
          name: deals.name,
          amount: deals.amount,
          probability: deals.probability,
          expectedCloseDate: deals.expectedCloseDate,
          lostReason: deals.lostReason,
          wonLostAt: deals.wonLostAt,
          description: deals.description,
          createdAt: deals.createdAt,
          stageId: deals.stageId,
          stageName: pipelineStages.name,
          stageColor: pipelineStages.color,
          stageIsTerminal: pipelineStages.isTerminal,
          companyId: deals.companyId,
          companyName: companies.legalName,
          primaryContactId: deals.primaryContactId,
          contactName: sql<string | null>`concat(${contacts.firstName}, ' ', ${contacts.lastName})`,
          ownerId: deals.ownerId,
          ownerName: users.name,
          ownerEmail: users.email,
        })
        .from(deals)
        .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .leftJoin(companies, eq(deals.companyId, companies.id))
        .leftJoin(contacts, eq(deals.primaryContactId, contacts.id))
        .leftJoin(users, eq(deals.ownerId, users.id))
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }
      return row;
    }),

  /** Activities for one deal, newest first. */
  timeline: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [deal] = await ctx.db
        .select({ id: deals.id })
        .from(deals)
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);
      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }

      return ctx.db
        .select({
          id: activities.id,
          type: activities.type,
          subject: activities.subject,
          body: activities.body,
          activityAt: activities.activityAt,
          createdByName: users.name,
          creatorEmail: users.email,
        })
        .from(activities)
        .leftJoin(users, eq(activities.createdById, users.id))
        .where(eq(activities.dealId, input.id))
        .orderBy(desc(activities.activityAt));
    }),

  /** Audit history for one deal. */
  history: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [deal] = await ctx.db
        .select({ id: deals.id })
        .from(deals)
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);
      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }

      return ctx.db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .where(
          and(
            eq(auditLogs.entityType, "deal"),
            eq(auditLogs.entityId, String(input.id)),
          ),
        )
        .orderBy(desc(auditLogs.createdAt));
    }),

  /** Single deal by id, scoped by ownership. */
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [deal] = await ctx.db
        .select()
        .from(deals)
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }
      return deal;
    }),

  /** Create a deal in the first stage of the first pipeline. */
  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().trim().min(1, "Deal name is required").max(255),
        amount: z.number().min(0, "Amount cannot be negative"),
        expectedCloseDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [company] = await ctx.db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.id, input.companyId),
            inArray(companies.ownerId, allowedOwnerIds),
          ),
        )
        .limit(1);

      if (!company) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot access this company",
        });
      }

      const [pipeline] = await ctx.db
        .select({ id: pipelines.id })
        .from(pipelines)
        .orderBy(asc(pipelines.id))
        .limit(1);
      if (!pipeline) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No sales pipeline is configured",
        });
      }

      const [stage] = await ctx.db
        .select({
          id: pipelineStages.id,
          probabilityDefault: pipelineStages.probabilityDefault,
        })
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipeline.id))
        .orderBy(asc(pipelineStages.position))
        .limit(1);
      if (!stage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No pipeline stage is configured",
        });
      }

      const [deal] = await ctx.db
        .insert(deals)
        .values({
          companyId: input.companyId,
          name: input.name,
          amount: input.amount.toFixed(2),
          probability: stage.probabilityDefault,
          expectedCloseDate: input.expectedCloseDate
            ? input.expectedCloseDate.toISOString().slice(0, 10)
            : null,
          ownerId: ctx.session.user.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          description: "Created from company workspace.",
        })
        .returning();

      return deal;
    }),

  /** Update editable deal fields. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(255).optional(),
        amount: z.number().min(0).optional(),
        expectedCloseDate: z.coerce.date().optional(),
        description: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [existing] = await ctx.db
        .select()
        .from(deals)
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.amount !== undefined)
        updateData.amount = input.amount.toFixed(2);
      if (input.expectedCloseDate !== undefined)
        updateData.expectedCloseDate = input.expectedCloseDate
          .toISOString()
          .slice(0, 10);
      if (input.description !== undefined)
        updateData.description = input.description;

      const [updated] = await ctx.db
        .update(deals)
        .set(updateData)
        .where(eq(deals.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Move a deal to another stage.
   * Server-side business rules:
   * - closed deals (Won/Lost) cannot move again
   * - Won requires expected close date and amount > 0
   * - Lost requires a lost reason
   * - every move writes an audit log entry
   */
  updateStage: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        stageId: z.number().int().positive(),
        lostReason: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [existing] = await ctx.db
        .select()
        .from(deals)
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }

      const [fromStage] = existing.stageId
        ? await ctx.db
            .select({
              name: pipelineStages.name,
              isTerminal: pipelineStages.isTerminal,
            })
            .from(pipelineStages)
            .where(eq(pipelineStages.id, existing.stageId))
            .limit(1)
        : [];

      if (fromStage?.isTerminal) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This deal is already closed (Won/Lost) and cannot change stage.",
        });
      }

      const [targetStage] = await ctx.db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, input.stageId))
        .limit(1);

      if (!targetStage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid target stage",
        });
      }
      if (!targetStage.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target stage is not active",
        });
      }

      const stageKey = targetStage.name.trim().toLowerCase();
      const isWon = stageKey === "won";
      const isLost = stageKey === "lost";

      if (isWon) {
        const amount = Number(existing.amount);
        if (!existing.expectedCloseDate || !(amount > 0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A deal needs an expected close date and a value greater than zero before it can be marked Won.",
          });
        }
      }

      if (isLost && (!input.lostReason || input.lostReason.trim().length === 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A lost reason is required before moving a deal to Lost.",
        });
      }

      const [updated] = await ctx.db
        .update(deals)
        .set({
          stageId: targetStage.id,
          probability: targetStage.probabilityDefault,
          lostReason: isLost ? (input.lostReason ?? null) : existing.lostReason,
          wonLostAt: targetStage.isTerminal ? new Date() : null,
        })
        .where(eq(deals.id, input.id))
        .returning();

      await ctx.db.insert(auditLogs).values({
        actorId: ctx.session.user.id,
        action: "stage_changed",
        entityType: "deal",
        entityId: String(input.id),
        metadata: {
          fromStageId: existing.stageId,
          fromStageName: fromStage?.name ?? null,
          toStageId: targetStage.id,
          toStageName: targetStage.name,
        },
      });

      return updated;
    }),

  /** Delete a deal (scoped). */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const allowedOwnerIds =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const [existing] = await ctx.db
        .select()
        .from(deals)
        .where(
          and(eq(deals.id, input.id), inArray(deals.ownerId, allowedOwnerIds)),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found or access denied",
        });
      }

      await ctx.db.delete(deals).where(eq(deals.id, input.id));
      return { success: true as const };
    }),
});