"use client";

import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Layers3,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-AE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatMoney(value: number) {
  return currency.format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <Card className="border-0 bg-white/80 shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-[#718078]">{label}</p>
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf2eb] text-[#26705b]">
            <Icon className="size-[18px]" />
          </span>
        </div>
        <p className="mt-5 text-2xl font-semibold tracking-tight text-[#17342c]">
          {value}
        </p>
        <p className="mt-1 text-xs text-[#849088]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-lg bg-[#e5e1d8]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-36 rounded-2xl bg-white/70" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 rounded-2xl bg-white/70" />
        <div className="h-96 rounded-2xl bg-white/70" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const overview = api.dashboard.overview.useQuery();

  if (overview.isLoading) return <DashboardSkeleton />;
  if (overview.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load the dashboard right now. Please refresh and try again.
      </div>
    );
  }
  if (!overview.data) return <DashboardSkeleton />;

  const data = overview.data;
  const hasData = data.openDealsCount > 0 || data.recentActivities.length > 0;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-[#9a7a31] uppercase">
            Revenue command center
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17342c] sm:text-4xl">
            Good morning, here&apos;s the shape of your pipeline.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#718078]">
            A focused view of active opportunities, follow-ups, and the movement
            your team can act on today.
          </p>
        </div>
        <div className="rounded-full border border-[#ded8ca] bg-[#fbfaf7] px-4 py-2 text-sm text-[#718078]">
          {data.scope === "team" ? "Team view" : "Personal view"}
        </div>
      </section>

      {!hasData ? (
        <Card className="border-0 bg-white/80 shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#edf2eb] text-[#26705b]">
              <Layers3 />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-[#17342c]">
              Your pipeline is ready for its first signal
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#718078]">
              Create a deal or log an activity to see your revenue rhythm take
              shape here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Open pipeline"
              value={formatMoney(data.totalPipelineValue)}
              detail={`${data.openDealsCount} active deals`}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Weighted pipeline"
              value={formatMoney(data.weightedPipelineValue)}
              detail="Probability-adjusted value"
              icon={Target}
            />
            <MetricCard
              label="Closing this month"
              value={String(data.dealsClosingThisMonth)}
              detail={`${formatPercent(data.winRate)} win rate`}
              icon={CalendarDays}
            />
            <MetricCard
              label="Overdue follow-ups"
              value={String(data.overdueFollowUps)}
              detail={`${formatPercent(data.quoteAcceptanceRate)} quote acceptance`}
              icon={Clock3}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="border-0 bg-white/80 shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg text-[#17342c]">
                    Revenue by stage
                  </CardTitle>
                  <p className="mt-1 text-sm text-[#849088]">
                    Where your active and closed value sits.
                  </p>
                </div>
                <ArrowUpRight className="size-5 text-[#d9a441]" />
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.revenueByStage}
                      margin={{ left: -18, right: 8, top: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#2d8069"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#2d8069"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#849088" }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={54}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#849088" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `${Math.round(value / 1000)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value) => formatMoney(Number(value))}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e4ded2",
                          boxShadow: "0 10px 24px rgba(42,55,45,.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#26705b"
                        strokeWidth={3}
                        fill="url(#revenueFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/80 shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
              <CardHeader>
                <CardTitle className="text-lg text-[#17342c]">
                  Pipeline summary
                </CardTitle>
                <p className="mt-1 text-sm text-[#849088]">
                  AED value by stage
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.revenueByStage.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color ?? "#26705b" }}
                      />
                      <span className="truncate text-sm text-[#40564d]">
                        {stage.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#17342c]">
                      {formatMoney(stage.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            {data.performance && (
              <Card className="border-0 bg-[#173f34] text-[#f7f5ef] shadow-[0_12px_32px_rgba(42,55,45,0.12)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[#f7f5ef]">
                    Personal versus team
                  </CardTitle>
                  <p className="mt-1 text-sm text-[#b7c9bf]">
                    Open pipeline contribution
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-xs tracking-wider text-[#b7c9bf] uppercase">
                      Your pipeline
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatMoney(data.performance.personalPipelineValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs tracking-wider text-[#b7c9bf] uppercase">
                      Team pipeline
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-[#e5c36d]">
                      {formatMoney(data.performance.teamPipelineValue)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="border-0 bg-white/80 shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#17342c]">
                  <Activity className="size-5 text-[#26705b]" /> Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {data.recentActivities.map((activity, index) => (
                    <div
                      key={`${activity.subject}-${index}`}
                      className="flex gap-3"
                    >
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#d9a441]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#17342c]">
                          {activity.subject}
                        </p>
                        <p className="mt-1 text-xs text-[#849088]">
                          {activity.companyName ?? "Unassigned company"} ·{" "}
                          {activity.creatorName ?? "Unknown creator"}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-[#849088]">
                        {dateFormatter.format(new Date(activity.date))}
                      </time>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
