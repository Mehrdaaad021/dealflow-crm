import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  activities,
  companies,
  contacts,
  deals,
  teamMembers,
} from "~/server/db/schema";

const activityTypes = [
  "call",
  "meeting",
  "email",
  "messaging",
  "note",
  "demo",
  "quotation_sent",
  "status_change",
] as const;

export const activitiesRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        contactId: z.number().int().positive().optional(),
        dealId: z.number().int().positive().optional(),
        type: z.enum(activityTypes),
        subject: z.string().trim().min(1, "Subject is required").max(255),
        body: z.string().trim().max(5000).optional(),
        occurredAt: z.coerce.date(),
        completed: z.boolean().default(true),
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
            ).map((member) => member.userId);
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
      if (!company) throw new Error("You cannot access this company");

      if (input.contactId) {
        const [contact] = await ctx.db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.id, input.contactId),
              eq(contacts.companyId, input.companyId),
            ),
          )
          .limit(1);
        if (!contact)
          throw new Error("Contact does not belong to this company");
      }
      if (input.dealId) {
        const [deal] = await ctx.db
          .select({ id: deals.id })
          .from(deals)
          .where(
            and(
              eq(deals.id, input.dealId),
              eq(deals.companyId, input.companyId),
            ),
          )
          .limit(1);
        if (!deal) throw new Error("Deal does not belong to this company");
      }

      const [activity] = await ctx.db
        .insert(activities)
        .values({
          companyId: input.companyId,
          contactId: input.contactId ?? null,
          dealId: input.dealId ?? null,
          type: input.type,
          subject: input.subject,
          body: input.body || null,
          activityAt: input.occurredAt,
          createdById: ctx.session.user.id,
          status: input.completed ? "completed" : "pending",
        })
        .returning();
      return activity;
    }),
});
