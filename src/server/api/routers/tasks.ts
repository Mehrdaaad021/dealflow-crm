import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  companies,
  deals,
  leads,
  tasks,
  teamMembers,
  users,
} from "~/server/db/schema";

const taskStatusEnum = z.enum(["open", "in_progress", "completed", "cancelled"]);
const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const tasksRouter = createTRPCRouter({
  /** Users the current caller may assign tasks to (rep: only self). */
  assignableUsers: protectedProcedure.query(async ({ ctx }) => {
    const allowed =
      ctx.session.user.role === "sales_rep"
        ? [ctx.session.user.id]
        : (
            await ctx.db
              .select({ userId: teamMembers.userId })
              .from(teamMembers)
              .where(eq(teamMembers.teamId, ctx.session.user.teamId))
          ).map((m) => m.userId);

    return ctx.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, allowed));
  }),

  /** Tasks visible to the current user, with related entity names. */
  list: protectedProcedure
    .input(
      z
        .object({
          status: taskStatusEnum.optional(),
          priority: taskPriorityEnum.optional(),
          assignedToId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const allowed =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      let scope = allowed;
      if (input?.assignedToId) {
        if (!allowed.includes(input.assignedToId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot view tasks assigned outside your scope",
          });
        }
        scope = [input.assignedToId];
      }

      const conditions = [inArray(tasks.assignedToId, scope)];
      if (input?.status) conditions.push(eq(tasks.status, input.status));
      if (input?.priority) conditions.push(eq(tasks.priority, input.priority));

      return ctx.db
        .select({
          id: tasks.id,
          title: tasks.title,
          dueAt: tasks.dueAt,
          priority: tasks.priority,
          status: tasks.status,
          reminder: tasks.reminder,
          notes: tasks.notes,
          companyId: tasks.companyId,
          companyName: companies.legalName,
          dealId: tasks.dealId,
          dealName: deals.name,
          leadId: tasks.leadId,
          leadName: leads.name,
          assignedToId: tasks.assignedToId,
          assigneeName: users.name,
          assigneeEmail: users.email,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .leftJoin(companies, eq(tasks.companyId, companies.id))
        .leftJoin(deals, eq(tasks.dealId, deals.id))
        .leftJoin(leads, eq(tasks.leadId, leads.id))
        .leftJoin(users, eq(tasks.assignedToId, users.id))
        .where(and(...conditions))
        .orderBy(asc(tasks.dueAt));
    }),

  /** Create a task, scoped to the caller's team/ownership. */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1, "Title is required").max(255),
        dueAt: z.coerce.date().optional(),
        priority: taskPriorityEnum.default("medium"),
        companyId: z.number().int().positive().optional(),
        dealId: z.number().int().positive().optional(),
        contactId: z.number().int().positive().optional(),
        leadId: z.number().int().positive().optional(),
        assignedToId: z.string().optional(),
        reminder: z.boolean().default(false),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allowed =
        ctx.session.user.role === "sales_rep"
          ? [ctx.session.user.id]
          : (
              await ctx.db
                .select({ userId: teamMembers.userId })
                .from(teamMembers)
                .where(eq(teamMembers.teamId, ctx.session.user.teamId))
            ).map((m) => m.userId);

      const assignee = input.assignedToId ?? ctx.session.user.id;
      if (!allowed.includes(assignee)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot assign a task outside your scope",
        });
      }

      if (input.dealId) {
        const [deal] = await ctx.db
          .select({ id: deals.id })
          .from(deals)
          .where(and(eq(deals.id, input.dealId), inArray(deals.ownerId, allowed)))
          .limit(1);
        if (!deal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deal not found or not accessible",
          });
        }
      }

      if (input.companyId) {
        const [company] = await ctx.db
          .select({ id: companies.id })
          .from(companies)
          .where(
            and(
              eq(companies.id, input.companyId),
              inArray(companies.ownerId, allowed),
            ),
          )
          .limit(1);
        if (!company) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Company not found or not accessible",
          });
        }
      }

      const [task] = await ctx.db
        .insert(tasks)
        .values({
          title: input.title,
          dueAt: input.dueAt ?? null,
          priority: input.priority,
          status: "open",
          companyId: input.companyId ?? null,
          dealId: input.dealId ?? null,
          contactId: input.contactId ?? null,
          leadId: input.leadId ?? null,
          assignedToId: assignee,
          reminder: input.reminder,
          notes: input.notes ?? null,
        })
        .returning();

      return task;
    }),

  /** Change task status (quick complete / reopen). */
  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: taskStatusEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allowed =
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
        .from(tasks)
        .where(
          and(eq(tasks.id, input.id), inArray(tasks.assignedToId, allowed)),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found or access denied",
        });
      }

      const [updated] = await ctx.db
        .update(tasks)
        .set({ status: input.status })
        .where(eq(tasks.id, input.id))
        .returning();

      return updated;
    }),

  /** Edit task fields. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(255).optional(),
        dueAt: z.coerce.date().optional(),
        priority: taskPriorityEnum.optional(),
        reminder: z.boolean().optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allowed =
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
        .from(tasks)
        .where(
          and(eq(tasks.id, input.id), inArray(tasks.assignedToId, allowed)),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found or access denied",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.dueAt !== undefined) updateData.dueAt = input.dueAt;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.reminder !== undefined) updateData.reminder = input.reminder;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await ctx.db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, input.id))
        .returning();

      return updated;
    }),

  /** Delete a task. */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const allowed =
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
        .from(tasks)
        .where(
          and(eq(tasks.id, input.id), inArray(tasks.assignedToId, allowed)),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found or access denied",
        });
      }

      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true as const };
    }),
});