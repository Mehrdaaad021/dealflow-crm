import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { auditLogs, products } from "~/server/db/schema";

const MANAGER_ROLES = ["sales_manager", "admin"];

export const productsRouter = createTRPCRouter({
  /** Who am I? (role-aware UI) */
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.session.user.id,
    role: ctx.session.user.role,
  })),

  /** Full product catalog (read for everyone signed in). */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(products).orderBy(asc(products.name));
  }),

  /** Create a product (manager/admin only). */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        sku: z.string().trim().min(1).max(100),
        description: z.string().max(2000).optional(),
        unit: z.string().trim().min(1).max(50),
        unitPrice: z.number().min(0),
        taxRate: z.number().min(0).max(100).default(5),
        category: z.string().trim().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!MANAGER_ROLES.includes(ctx.session.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a sales manager or admin can manage the catalog",
        });
      }

      const [existing] = await ctx.db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, input.sku))
        .limit(1);
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This SKU already exists in the catalog",
        });
      }

      const [created] = await ctx.db
        .insert(products)
        .values({
          name: input.name,
          sku: input.sku,
          description: input.description ?? null,
          unit: input.unit,
          unitPrice: input.unitPrice.toFixed(2),
          taxRate: input.taxRate.toFixed(2),
          category: input.category ?? null,
          status: "active",
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create the product",
        });
      }
      return created;
    }),

  /** Change a product price (manager/admin only, audited). */
  updatePrice: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!MANAGER_ROLES.includes(ctx.session.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a sales manager or admin can change prices",
        });
      }

      const [found] = await ctx.db
        .select()
        .from(products)
        .where(eq(products.id, input.id))
        .limit(1);
      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      const oldPrice = Number(found.unitPrice);
      if (oldPrice === input.unitPrice) return found;

      const [updated] = await ctx.db
        .update(products)
        .set({ unitPrice: input.unitPrice.toFixed(2) })
        .where(eq(products.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update the price",
        });
      }

      await ctx.db.insert(auditLogs).values({
        actorId: ctx.session.user.id,
        action: "product_price_changed",
        entityType: "product",
        entityId: String(input.id),
        metadata: { oldPrice, newPrice: input.unitPrice },
      });

      return updated;
    }),

  /** Activate / deactivate a product (manager/admin only). */
  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["active", "inactive"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!MANAGER_ROLES.includes(ctx.session.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a sales manager or admin can manage the catalog",
        });
      }

      const [found] = await ctx.db
        .select()
        .from(products)
        .where(eq(products.id, input.id))
        .limit(1);
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      const [updated] = await ctx.db
        .update(products)
        .set({ status: input.status })
        .where(eq(products.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update the product",
        });
      }
      return updated;
    }),
});