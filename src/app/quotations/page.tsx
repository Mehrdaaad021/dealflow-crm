"use client";

import { useState } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";

const aed = (v: string | number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(Number(v));

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_approval: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-800",
  sent: "bg-sky-100 text-sky-800",
  viewed: "bg-sky-100 text-sky-800",
  accepted: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-slate-200 text-slate-600",
};

export default function QuotationsPage() {
  const [status, setStatus] = useState("all");
  const listQ = api.quotations.list.useQuery(
    status === "all" ? undefined : { status: status as never },
  );

  const rows = listQ.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d3b]">
            Commercial documents
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#122f2a]">Quotations</h1>
          <p className="mt-1 text-sm text-[#5c6b66]">
            Every quote, its approval state, and its AED totals.
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="rounded-md bg-[#122f2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2420]"
        >
          + New quotation
        </Link>
      </div>

      <div className="mb-4">
        <select
          aria-label="Filter by status"
          className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm text-[#122f2a]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {listQ.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-white/70" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-medium text-[#122f2a]">No quotations yet</p>
          <p className="mt-1 text-sm text-[#5c6b66]">
            Create the first one with “+ New quotation”.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#eee7dc] text-xs uppercase tracking-wider text-[#5c6b66]">
              <tr>
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1ede5]">
              {rows.map((q) => (
                <tr key={q.id} className="hover:bg-[#faf7f2]">
                  <td className="px-4 py-3 font-semibold text-[#122f2a]">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="hover:underline hover:decoration-[#1f6f5c] hover:underline-offset-2"
                    >
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#5c6b66]">
                    {q.companyName}
                    {q.dealName && (
                      <span className="block text-xs text-[#8b9793]">
                        {q.dealName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        STATUS_STYLE[q.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {q.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#122f2a]">
                    {aed(q.total)}
                  </td>
                  <td className="px-4 py-3 text-[#5c6b66]">
                    {q.validUntil ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#5c6b66]">
                    {q.ownerName ?? q.ownerEmail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}