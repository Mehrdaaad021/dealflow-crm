import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { companies, contacts, teamMembers } from "~/server/db/schema";

const channels = ["email", "phone", "whatsapp", "sms", "other"] as const;
const statuses = ["active", "inactive"] as const;

async function canAccessCompany(ctx: any, companyId: number) {
  const allowedOwnerIds =
    ctx.session.user.role === "sales_rep"
      ? [ctx.session.user.id]
      : (
          await ctx.db
            .select({ userId: teamMembers.userId })
            .from(teamMembers)
            .where(eq(teamMembers.teamId, ctx.session.user.teamId))
        ).map((member: { userId: string }) => member.userId);
  const [company] = await ctx.db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        inArray(companies.ownerId, allowedOwnerIds),
      ),
    )
    .limit(1);
  return Boolean(company);
}

const contactInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  preferredCommunicationChannel: z.enum(channels).optional(),
  isDecisionMaker: z.boolean().default(false),
  status: z.enum(statuses).default("active"),
  notes: z.string().trim().max(2000).optional(),
});

export const contactsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(contactInput.extend({ companyId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canAccessCompany(ctx, input.companyId))) {
        throw new Error("You cannot access this company");
      }
      const [contact] = await ctx.db
        .insert(contacts)
        .values({
          ...input,
          email: input.email || null,
          phone: input.phone || null,
          notes: input.notes || null,
          ownerId: ctx.session.user.id,
        })
        .returning();
      return contact;
    }),

  update: protectedProcedure
    .input(contactInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ companyId: contacts.companyId })
        .from(contacts)
        .where(eq(contacts.id, input.id))
        .limit(1);
      if (!existing || !(await canAccessCompany(ctx, existing.companyId))) {
        throw new Error("You cannot access this contact");
      }
      const [contact] = await ctx.db
        .update(contacts)
        .set({
          ...input,
          id: undefined,
          email: input.email || null,
          phone: input.phone || null,
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, input.id))
        .returning();
      return contact;
    }),
});
