"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "~/trpc/react";

const aed = (v: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(v);

export default function AnalyticsPage() {
  const q = api.analytics.overview.useQuery();
  const data = q.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d3b]">
            Performance
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#122f2a]">Analytics</h1>
          <p className="mt-1 text-sm text-[#5c6b66]">
            Computed server-side from live CRM data.
          </p>
        </div>
        {data && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              data.scope === "team"
                ? "bg-[#1f6f5c]/15 text-[#1f6f5c]"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {data.scope === "team" ? "Team view" : "Personal view"}
          </span>
        )}
      </div>

      {q.isLoading || !data ? (
        <div className="h-96 animate-pulse rounded-xl bg-white/70" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Open pipeline", value: aed(data.openValue) },
              { label: "Won revenue", value: aed(data.wonValue) },
              { label: "Win rate", value: `${data.winRate}%` },
              { label: "Avg sales cycle", value: `${data.avgCycleDays} days` },
              { label: "Quote acceptance", value: `${data.quoteAcceptance}%` },
            ].map((k) => (
              <div key={k.label} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs text-[#5c6b66]">{k.label}</p>
                <p className="mt-1 text-xl font-bold text-[#122f2a]">
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
                Won revenue — last 6 months
              </h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyWon}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee7dc" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} width={70} />
                    <Tooltip
                      formatter={(value) => [aed(Number(value)), "Won"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #eee7dc",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="#1f6f5c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
                Pipeline funnel
              </h2>
              <ul className="mt-4 space-y-3">
                {data.funnel.map((f) => (
                  <li key={f.stage}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[#122f2a]">
                        {f.stage}
                      </span>
                      <span className="text-[#5c6b66]">
                        {f.count} · {aed(f.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[#f1ede5]">
                      <div
                        className="h-2 rounded-full bg-[#1f6f5c]"
                        style={{
                          width: `${Math.min(
                            100,
                            (f.value /
                              Math.max(
                                1,
                                ...data.funnel.map((x) => x.value),
                              )) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {data.scope === "team" && (
            <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#eee7dc] text-xs uppercase tracking-wider text-[#5c6b66]">
                  <tr>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3 text-right">Open value</th>
                    <th className="px-4 py-3 text-right">Won value</th>
                    <th className="px-4 py-3 text-right">Won / Lost</th>
                    <th className="px-4 py-3 text-right">Win rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1ede5]">
                  {data.perOwner.map((o) => (
                    <tr key={o.ownerId} className="hover:bg-[#faf7f2]">
                      <td className="px-4 py-3 font-semibold text-[#122f2a]">
                        {o.ownerName}
                      </td>
                      <td className="px-4 py-3 text-right text-[#5c6b66]">
                        {aed(o.openValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#1f6f5c]">
                        {aed(o.wonValue)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#5c6b66]">
                        {o.wonCount} / {o.lostCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#122f2a]">
                        {o.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}