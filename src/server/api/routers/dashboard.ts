import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  activities,
  companies,
  deals,
  pipelineStages,
  quotations,
  tasks,
  teamMembers,
  users,
} from "~/server/db/schema";

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const startOfNextMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

const startOfTomorrow = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );

const toNumber = (value: string | null) => Number(value ?? 0);

export const dashboardRouter = createTRPCRouter({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const isTeamScoped = user.role === "sales_manager" || user.role === "admin";

    const memberRows = isTeamScoped
      ? await ctx.db
          .select({ userId: teamMembers.userId })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, user.teamId))
      : [{ userId: user.id }];
    const scopedUserIds = memberRows.map(({ userId }) => userId);

    const scopedDeals = await ctx.db
      .select({
        id: deals.id,
        ownerId: deals.ownerId,
        amount: deals.amount,
        probability: deals.probability,
        expectedCloseDate: deals.expectedCloseDate,
        stageId: deals.stageId,
        stageName: pipelineStages.name,
        stagePosition: pipelineStages.position,
        isTerminal: pipelineStages.isTerminal,
      })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(inArray(deals.ownerId, scopedUserIds));

    const openDeals = scopedDeals.filter((deal) => !deal.isTerminal);
    const wonDeals = scopedDeals.filter((deal) => deal.stageName === "Won");
    const lostDeals = scopedDeals.filter((deal) => deal.stageName === "Lost");
    const monthStart = startOfMonth(new Date());
    const nextMonthStart = startOfNextMonth(new Date());
    const dealsClosingThisMonth = openDeals.filter((deal) => {
      if (!deal.expectedCloseDate) return false;
      const closeDate = new Date(`${deal.expectedCloseDate}T00:00:00.000Z`);
      return closeDate >= monthStart && closeDate < nextMonthStart;
    }).length;

    const totalPipelineValue = openDeals.reduce(
      (sum, deal) => sum + toNumber(deal.amount),
      0,
    );
    const weightedPipelineValue = openDeals.reduce(
      (sum, deal) => sum + (toNumber(deal.amount) * deal.probability) / 100,
      0,
    );
    const personalPipelineValue = isTeamScoped
      ? openDeals
          .filter((deal) => deal.ownerId === user.id)
          .reduce((sum, deal) => sum + toNumber(deal.amount), 0)
      : totalPipelineValue;

    const wonWithCycle = await ctx.db
      .select({ createdAt: deals.createdAt, wonLostAt: deals.wonLostAt })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(
        and(
          inArray(deals.ownerId, scopedUserIds),
          eq(pipelineStages.name, "Won"),
          sql`${deals.wonLostAt} is not null`,
        ),
      );
    const averageSalesCycle = wonWithCycle.length
      ? wonWithCycle.reduce((sum, deal) => {
          const created = deal.createdAt.getTime();
          const won = deal.wonLostAt?.getTime() ?? created;
          return sum + Math.max(0, (won - created) / 86400000);
        }, 0) / wonWithCycle.length
      : 0;

    const overdueFollowUps = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          inArray(tasks.assignedToId, scopedUserIds),
          eq(tasks.status, "open"),
          lt(tasks.dueAt, startOfTomorrow(new Date())),
        ),
      );

    const quoteCounts = await ctx.db
      .select({
        accepted: sql<number>`count(*) filter (where ${quotations.status} = 'accepted')`,
        decided: sql<number>`count(*) filter (where ${quotations.status} in ('accepted', 'rejected'))`,
      })
      .from(quotations)
      .where(inArray(quotations.ownerId, scopedUserIds));

    const stageRows = await ctx.db
      .select({
        id: pipelineStages.id,
        name: pipelineStages.name,
        position: pipelineStages.position,
        color: pipelineStages.color,
        amount: sql<string>`coalesce(sum(${deals.amount}), 0)`,
      })
      .from(pipelineStages)
      .leftJoin(
        deals,
        and(
          eq(deals.stageId, pipelineStages.id),
          inArray(deals.ownerId, scopedUserIds),
        ),
      )
      .groupBy(
        pipelineStages.id,
        pipelineStages.name,
        pipelineStages.position,
        pipelineStages.color,
      )
      .orderBy(pipelineStages.position);

    const recentActivities = await ctx.db
      .select({
        type: activities.type,
        subject: activities.subject,
        date: activities.activityAt,
        companyName: companies.legalName,
        creatorName: users.name,
      })
      .from(activities)
      .leftJoin(companies, eq(activities.companyId, companies.id))
      .leftJoin(users, eq(activities.createdById, users.id))
      .where(inArray(activities.createdById, scopedUserIds))
      .orderBy(desc(activities.activityAt))
      .limit(10);

    return {
      scope: isTeamScoped ? "team" : "personal",
      totalPipelineValue,
      weightedPipelineValue,
      openDealsCount: openDeals.length,
      dealsClosingThisMonth,
      winRate:
        wonDeals.length + lostDeals.length > 0
          ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
          : 0,
      averageSalesCycle,
      overdueFollowUps: Number(overdueFollowUps[0]?.count ?? 0),
      quoteAcceptanceRate:
        Number(quoteCounts[0]?.decided ?? 0) > 0
          ? (Number(quoteCounts[0]?.accepted ?? 0) /
              Number(quoteCounts[0]?.decided ?? 0)) *
            100
          : 0,
      revenueByStage: stageRows.map((stage) => ({
        ...stage,
        amount: toNumber(stage.amount),
      })),
      recentActivities,
      performance: isTeamScoped
        ? {
            personalPipelineValue,
            teamPipelineValue: totalPipelineValue,
          }
        : null,
    };
  }),
});
