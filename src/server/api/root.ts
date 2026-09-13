import { activitiesRouter } from "~/server/api/routers/activities";
import { analyticsRouter } from "~/server/api/routers/analytics";
import { companiesRouter } from "~/server/api/routers/companies";
import { contactsRouter } from "~/server/api/routers/contacts";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { dealsRouter } from "~/server/api/routers/deals";
import { leadsRouter } from "~/server/api/routers/leads";
import { postRouter } from "~/server/api/routers/post";
import { productsRouter } from "~/server/api/routers/products";
import { quotationsRouter } from "~/server/api/routers/quotations";
import { tasksRouter } from "~/server/api/routers/tasks";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  activities: activitiesRouter,
  analytics: analyticsRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
  dashboard: dashboardRouter,
  deals: dealsRouter,
  leads: leadsRouter,
  post: postRouter,
  products: productsRouter,
  quotations: quotationsRouter,
  tasks: tasksRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);