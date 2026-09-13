import { eq, inArray } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  deals,
  pipelineStages,
  quotations,
  teamMembers,
  users,
} from "~/server/db/schema";

export const analyticsRouter = createTRPCRouter({
  /**
   * Team or personal performance analytics.
   * sales_rep sees only their own numbers; manager/admin sees the whole team.
   * All math is computed server-side.
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    const isRep = ctx.session.user.role === "sales_rep";
    const allowedOwnerIds = isRep
      ? [ctx.session.user.id]
      : (
          await ctx.db
            .select({ userId: teamMembers.userId })
            .from(teamMembers)
            .where(eq(teamMembers.teamId, ctx.session.user.teamId))
        ).map((m) => m.userId);

    const dealRows = await ctx.db
      .select({
        id: deals.id,
        amount: deals.amount,
        stageName: pipelineStages.name,
        stageIsTerminal: pipelineStages.isTerminal,
        ownerId: deals.ownerId,
        ownerName: users.name,
        ownerEmail: users.email,
        wonLostAt: deals.wonLostAt,
        createdAt: deals.createdAt,
      })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(inArray(deals.ownerId, allowedOwnerIds));

    const quoteRows = await ctx.db
      .select({ id: quotations.id, status: quotations.status })
      .from(quotations)
      .where(inArray(quotations.ownerId, allowedOwnerIds));

    const open = dealRows.filter((d) => !d.stageIsTerminal);
    const won = dealRows.filter(
      (d) => d.stageName?.trim().toLowerCase() === "won",
    );
    const lost = dealRows.filter(
      (d) => d.stageName?.trim().toLowerCase() === "lost",
    );

    const openValue = open.reduce((s, d) => s + Number(d.amount), 0);
    const wonValue = won.reduce((s, d) => s + Number(d.amount), 0);
    const winRate =
      won.length + lost.length > 0
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0;

    const cycleDays = won
      .filter((w) => w.wonLostAt)
      .map(
        (w) => (w.wonLostAt!.getTime() - w.createdAt.getTime()) / 86400000,
      );
    const avgCycleDays = cycleDays.length
      ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
      : 0;

    const terminalQuotes = quoteRows.filter((q) =>
      ["accepted", "rejected", "expired"].includes(q.status),
    );
    const acceptedQuotes = quoteRows.filter((q) => q.status === "accepted");
    const quoteAcceptance = terminalQuotes.length
      ? Math.round((acceptedQuotes.length / terminalQuotes.length) * 100)
      : 0;

    const ownerMap = new Map<
      string,
      {
        ownerId: string;
        ownerName: string;
        openValue: number;
        wonValue: number;
        wonCount: number;
        lostCount: number;
      }
    >();
    for (const d of dealRows) {
      const key = d.ownerId ?? "unassigned";
      const entry = ownerMap.get(key) ?? {
        ownerId: key,
        ownerName: d.ownerName ?? d.ownerEmail ?? "Unassigned",
        openValue: 0,
        wonValue: 0,
        wonCount: 0,
        lostCount: 0,
      };
      const value = Number(d.amount);
      if (!d.stageIsTerminal) entry.openValue += value;
      if (d.stageName?.trim().toLowerCase() === "won") {
        entry.wonValue += value;
        entry.wonCount += 1;
      }
      if (d.stageName?.trim().toLowerCase() === "lost") entry.lostCount += 1;
      ownerMap.set(key, entry);
    }
    const perOwner = [...ownerMap.values()].map((o) => ({
      ...o,
      openValue: Math.round(o.openValue),
      wonValue: Math.round(o.wonValue),
      winRate:
        o.wonCount + o.lostCount > 0
          ? Math.round((o.wonCount / (o.wonCount + o.lostCount)) * 100)
          : 0,
    }));

    const now = new Date();
    const monthlyWon: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyWon.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-AE", { month: "short" }),
        total: 0,
      });
    }
    for (const w of won) {
      if (!w.wonLostAt) continue;
      const key = `${w.wonLostAt.getFullYear()}-${String(
        w.wonLostAt.getMonth() + 1,
      ).padStart(2, "0")}`;
      const bucket = monthlyWon.find((m) => m.key === key);
      if (bucket) bucket.total = Math.round(bucket.total + Number(w.amount));
    }

    const stageMap = new Map<string, { stage: string; count: number; value: number }>();
    for (const d of dealRows) {
      const name = d.stageName ?? "No stage";
      const entry = stageMap.get(name) ?? { stage: name, count: 0, value: 0 };
      entry.count += 1;
      entry.value += Number(d.amount);
      stageMap.set(name, entry);
    }
    const funnel = [...stageMap.values()].map((s) => ({
      ...s,
      value: Math.round(s.value),
    }));

    return {
      scope: isRep ? ("personal" as const) : ("team" as const),
      openValue: Math.round(openValue),
      wonValue: Math.round(wonValue),
      winRate,
      avgCycleDays,
      quoteAcceptance,
      perOwner,
      monthlyWon,
      funnel,
    };
  }),
});