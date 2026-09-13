import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  auditLogs,
  companies,
  deals,
  products,
  quotationLineItems,
  quotations,
  teamMembers,
  users,
} from "~/server/db/schema";
import {
  canTransitionQuote,
  computeTotals,
  isApproverRole,
  round2,
} from "~/server/business-rules";
import { sendQuotationStatusEmail } from "~/server/email";

const lineItemInput = z.object({
  productId: z.number().int().positive().optional(),
  description: z.string().trim().min(1, "Description is required").max(1000),
  sku: z.string().trim().max(100).optional(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  discount: z.number().min(0, "Discount cannot be negative").default(0),
  taxRate: z.number().min(0).max(100).default(5),
});

export const quotationsRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.session.user.id,
    role: ctx.session.user.role,
  })),

  catalog: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        unit: products.unit,
        unitPrice: products.unitPrice,
        taxRate: products.taxRate,
      })
      .from(products)
      .where(eq(products.status, "active"))
      .orderBy(asc(products.name));
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "draft",
              "pending_approval",
              "approved",
              "sent",
              "viewed",
              "accepted",
              "rejected",
              "expired",
            ])
            .optional(),
        })
        .optional(),
    )
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

      const conditions = [inArray(quotations.ownerId, allowedOwnerIds)];
      if (input?.status) conditions.push(eq(quotations.status, input.status));

      return ctx.db
        .select({
          id: quotations.id,
          quoteNumber: quotations.quoteNumber,
          status: quotations.status,
          currency: quotations.currency,
          validUntil: quotations.validUntil,
          subtotal: quotations.subtotal,
          discount: quotations.discount,
          tax: quotations.tax,
          total: quotations.total,
          companyId: quotations.companyId,
          companyName: companies.legalName,
          dealId: quotations.dealId,
          dealName: deals.name,
          ownerId: quotations.ownerId,
          ownerName: users.name,
          ownerEmail: users.email,
          sentAt: quotations.sentAt,
          createdAt: quotations.createdAt,
        })
        .from(quotations)
        .leftJoin(companies, eq(quotations.companyId, companies.id))
        .leftJoin(deals, eq(quotations.dealId, deals.id))
        .leftJoin(users, eq(quotations.ownerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(quotations.createdAt));
    }),

  byId: protectedProcedure
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

      const [quote] = await ctx.db
        .select({
          id: quotations.id,
          quoteNumber: quotations.quoteNumber,
          status: quotations.status,
          currency: quotations.currency,
          validUntil: quotations.validUntil,
          subtotal: quotations.subtotal,
          discount: quotations.discount,
          tax: quotations.tax,
          total: quotations.total,
          customerNotes: quotations.customerNotes,
          internalNotes: quotations.internalNotes,
          sentAt: quotations.sentAt,
          createdAt: quotations.createdAt,
          companyId: quotations.companyId,
          companyName: companies.legalName,
          dealId: quotations.dealId,
          dealName: deals.name,
          ownerId: quotations.ownerId,
          ownerName: users.name,
          ownerEmail: users.email,
        })
        .from(quotations)
        .leftJoin(companies, eq(quotations.companyId, companies.id))
        .leftJoin(deals, eq(quotations.dealId, deals.id))
        .leftJoin(users, eq(quotations.ownerId, users.id))
        .where(
          and(
            eq(quotations.id, input.id),
            inArray(quotations.ownerId, allowedOwnerIds),
          ),
        )
        .limit(1);

      if (!quote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found or access denied",
        });
      }

      const lineItems = await ctx.db
        .select()
        .from(quotationLineItems)
        .where(eq(quotationLineItems.quotationId, input.id))
        .orderBy(asc(quotationLineItems.id));

      return { ...quote, lineItems };
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        dealId: z.number().int().positive().optional(),
        validUntil: z.coerce.date().optional(),
        customerNotes: z.string().max(2000).optional(),
        internalNotes: z.string().max(2000).optional(),
        quoteDiscount: z.number().min(0).default(0),
        items: z
          .array(lineItemInput)
          .min(1, "At least one line item is required"),
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
          message: "You cannot create a quotation for this company",
        });
      }

      if (input.dealId) {
        const [deal] = await ctx.db
          .select({ id: deals.id })
          .from(deals)
          .where(
            and(
              eq(deals.id, input.dealId),
              eq(deals.companyId, input.companyId),
              inArray(deals.ownerId, allowedOwnerIds),
            ),
          )
          .limit(1);
        if (!deal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Deal not found or does not belong to this company",
          });
        }
      }

      const lines: {
        productId: number | null;
        description: string;
        sku: string | null;
        quantity: number;
        unitPrice: number;
        discount: number;
        taxRate: number;
        lineSubtotal: number;
        lineTotal: number;
      }[] = [];

      for (const item of input.items) {
        let description = item.description;
        let sku = item.sku ?? null;
        let unitPrice = item.unitPrice;
        let taxRate = item.taxRate;
        let productId: number | null = null;

        if (item.productId) {
          const [product] = await ctx.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);
          if (!product) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Product not found in catalog",
            });
          }
          productId = product.id;
          description = product.name;
          sku = product.sku;
          unitPrice = Number(product.unitPrice);
          taxRate = Number(product.taxRate);
        }

        const lineSubtotal = round2(item.quantity * unitPrice);
        const lineTotal = round2(lineSubtotal - item.discount);
        if (lineTotal < 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Line discount cannot exceed line subtotal for "${description}"`,
          });
        }
        lines.push({
          productId,
          description,
          sku,
          quantity: item.quantity,
          unitPrice,
          discount: item.discount,
          taxRate,
          lineSubtotal,
          lineTotal,
        });
      }

      const totals = computeTotals(lines, input.quoteDiscount);
      if (totals.total < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quotation discount cannot exceed the subtotal",
        });
      }

      const countRows = await ctx.db.select({ c: count() }).from(quotations);
      const existingCount = countRows[0]?.c ?? 0;
      const quoteNumber = `Q-${new Date().getFullYear()}-${String(
        existingCount + 1,
      ).padStart(4, "0")}`;

      const [created] = await ctx.db
        .insert(quotations)
        .values({
          quoteNumber,
          companyId: input.companyId,
          dealId: input.dealId ?? null,
          ownerId: ctx.session.user.id,
          status: "draft",
          currency: "AED",
          validUntil: input.validUntil
            ? input.validUntil.toISOString().slice(0, 10)
            : null,
          subtotal: totals.subtotal.toFixed(2),
          discount: totals.discount.toFixed(2),
          tax: totals.tax.toFixed(2),
          total: totals.total.toFixed(2),
          customerNotes: input.customerNotes ?? null,
          internalNotes: input.internalNotes ?? null,
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create the quotation",
        });
      }

      await ctx.db.insert(quotationLineItems).values(
        lines.map((l) => ({
          quotationId: created.id,
          productId: l.productId,
          description: l.description,
          sku: l.sku,
          quantity: String(l.quantity),
          unitPrice: l.unitPrice.toFixed(2),
          discount: l.discount.toFixed(2),
          taxRate: l.taxRate.toFixed(2),
          lineSubtotal: l.lineSubtotal.toFixed(2),
          lineTotal: l.lineTotal.toFixed(2),
        })),
      );

      return created;
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum([
          "pending_approval",
          "approved",
          "sent",
          "accepted",
          "rejected",
          "expired",
        ]),
        reason: z.string().trim().max(1000).optional(),
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

      const [found] = await ctx.db
        .select()
        .from(quotations)
        .where(
          and(
            eq(quotations.id, input.id),
            inArray(quotations.ownerId, allowedOwnerIds),
          ),
        )
        .limit(1);

      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found or access denied",
        });
      }

      const currentStatus = found.status;

      if (!canTransitionQuote(currentStatus, input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot move a quotation from ${currentStatus} to ${input.status}`,
        });
      }

      const isApprover = isApproverRole(ctx.session.user.role);
      const isOwner = found.ownerId === ctx.session.user.id;

      if (input.status === "approved" && !isApprover) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a sales manager or admin can approve quotations",
        });
      }
      if (
        input.status === "rejected" &&
        currentStatus === "pending_approval" &&
        !isApprover
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a sales manager or admin can reject a quotation in review",
        });
      }
      if (input.status === "rejected" && !input.reason) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reason is required when rejecting a quotation",
        });
      }
      if (
        ["sent", "accepted", "expired"].includes(input.status) &&
        !isOwner &&
        !isApprover
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot perform this action on this quotation",
        });
      }

      const [updated] = await ctx.db
        .update(quotations)
        .set({
          status: input.status,
          sentAt: input.status === "sent" ? new Date() : found.sentAt,
          internalNotes:
            input.status === "rejected" && input.reason
              ? `${found.internalNotes ? found.internalNotes + "\n" : ""}Rejected: ${input.reason}`
              : found.internalNotes,
        })
        .where(eq(quotations.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update the quotation",
        });
      }

      await ctx.db.insert(auditLogs).values({
        actorId: ctx.session.user.id,
        action:
          input.status === "approved"
            ? "quote_approved"
            : input.status === "rejected"
              ? "quote_rejected"
              : "quote_status_changed",
        entityType: "quote",
        entityId: String(input.id),
        metadata: {
          fromStatus: currentStatus,
          toStatus: input.status,
          reason: input.reason ?? null,
        },
      });

      if (input.status === "approved" || input.status === "rejected") {
        const [owner] = await ctx.db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, found.ownerId))
          .limit(1);
        const [company] = await ctx.db
          .select({ legalName: companies.legalName })
          .from(companies)
          .where(eq(companies.id, found.companyId))
          .limit(1);
        const [actor] = await ctx.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, ctx.session.user.id))
          .limit(1);

        const recipient =
          process.env.DEMO_EMAIL_RECIPIENT ?? owner?.email ?? "";
        if (recipient) {
          void sendQuotationStatusEmail({
            to: recipient,
            quoteNumber: found.quoteNumber,
            companyName: company?.legalName ?? null,
            status: input.status,
            reason: input.reason ?? null,
            actorName: actor?.name ?? null,
          }).catch(() => {
            // swallow — UI must not suffer for email failures
          });
        }
      }

      return updated;
    }),
});