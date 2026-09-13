"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";

const aed = (v: string | number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
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

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = Number(params?.id);
  const enabled = Number.isInteger(quoteId) && quoteId > 0;

  const quoteQ = api.quotations.byId.useQuery({ id: quoteId }, { enabled });
  const meQ = api.quotations.me.useQuery(undefined, { enabled });
  const utils = api.useUtils();

  const setStatus = api.quotations.setStatus.useMutation({
    onSuccess: () => {
      void utils.quotations.byId.invalidate();
      void utils.quotations.list.invalidate();
      toast.success("Quotation status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const quote = quoteQ.data;
  const me = meQ.data;
  const isApprover =
    me?.role === "sales_manager" || me?.role === "admin";
  const isOwner = !!me && !!quote && quote.ownerId === me.id;

  const act = (
    status: "pending_approval" | "approved" | "sent" | "accepted" | "expired",
  ) => setStatus.mutate({ id: quoteId, status });

  const confirmReject = () => {
    if (reason.trim().length === 0) {
      setReasonError("A reason is required when rejecting a quotation.");
      return;
    }
    setStatus.mutate(
      { id: quoteId, status: "rejected", reason: reason.trim() },
      { onSettled: () => setRejectOpen(false) },
    );
  };

  if (!enabled) {
    return (
      <div className="p-10 text-center text-sm text-[#5c6b66]">
        Invalid quotation id.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav className="mb-4 text-sm text-[#5c6b66]">
        <Link href="/quotations" className="hover:text-[#1f6f5c]">
          Quotations
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#122f2a]">{quote?.quoteNumber ?? "…"}</span>
      </nav>

      {quoteQ.isLoading ? (
        <div className="h-72 animate-pulse rounded-xl bg-white/70" />
      ) : !quote ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-medium text-[#122f2a]">
            Quotation not found or access denied
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#122f2a]">
                    {quote.quoteNumber}
                  </h1>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      STATUS_STYLE[quote.status] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {quote.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#5c6b66]">
                  <Link
                    href={`/companies/${quote.companyId}`}
                    className="underline decoration-[#d8cfc0] underline-offset-2 hover:text-[#1f6f5c]"
                  >
                    {quote.companyName}
                  </Link>
                  {quote.dealName && <span> · {quote.dealName}</span>}
                  <span> · {quote.ownerName ?? quote.ownerEmail}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#122f2a]">
                  {aed(quote.total)}
                </p>
                <p className="text-xs text-[#5c6b66]">
                  {quote.currency} · valid until {quote.validUntil ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-[#eee7dc] pt-4">
              {quote.status === "draft" && isOwner && (
                <button
                  onClick={() => act("pending_approval")}
                  disabled={setStatus.isPending}
                  className="rounded-md bg-[#1f6f5c] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
                >
                  Submit for approval
                </button>
              )}
              {quote.status === "pending_approval" && isApprover && (
                <>
                  <button
                    onClick={() => act("approved")}
                    disabled={setStatus.isPending}
                    className="rounded-md bg-[#1f6f5c] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setReason("");
                      setReasonError("");
                      setRejectOpen(true);
                    }}
                    className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
                  >
                    Reject
                  </button>
                </>
              )}
              {quote.status === "approved" && (isOwner || isApprover) && (
                <button
                  onClick={() => act("sent")}
                  disabled={setStatus.isPending}
                  className="rounded-md bg-[#122f2a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0d2420] disabled:opacity-60"
                >
                  Mark sent
                </button>
              )}
              {quote.status === "sent" && (isOwner || isApprover) && (
                <>
                  <button
                    onClick={() => act("accepted")}
                    disabled={setStatus.isPending}
                    className="rounded-md bg-[#1f6f5c] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
                  >
                    Mark accepted
                  </button>
                  <button
                    onClick={() => {
                      setReason("");
                      setReasonError("");
                      setRejectOpen(true);
                    }}
                    className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
                  >
                    Mark rejected
                  </button>
                  <button
                    onClick={() => act("expired")}
                    disabled={setStatus.isPending}
                    className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
                  >
                    Mark expired
                  </button>
                </>
              )}
              {["accepted", "rejected", "expired"].includes(quote.status) && (
                <span className="rounded-md bg-[#122f2a]/10 px-3 py-1.5 text-sm font-medium text-[#122f2a]">
                  Closed: {quote.status}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
              Line items (price snapshots)
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#eee7dc] text-xs uppercase tracking-wider text-[#5c6b66]">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit price</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2 text-right">VAT %</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1ede5]">
                  {quote.lineItems.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-medium text-[#122f2a]">
                        {l.description}
                      </td>
                      <td className="px-3 py-2 text-[#8b9793]">{l.sku ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{l.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {aed(l.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {aed(l.discount)}
                      </td>
                      <td className="px-3 py-2 text-right">{l.taxRate}%</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#122f2a]">
                        {aed(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-[#5c6b66]">
                <span>Subtotal</span>
                <span>{aed(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#5c6b66]">
                <span>Discount</span>
                <span>− {aed(quote.discount)}</span>
              </div>
              <div className="flex justify-between text-[#5c6b66]">
                <span>VAT 5%</span>
                <span>{aed(quote.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-[#e2dbd0] pt-2 text-base font-bold text-[#122f2a]">
                <span>Total</span>
                <span>{aed(quote.total)}</span>
              </div>
            </div>

            {(quote.customerNotes || quote.internalNotes) && (
              <div className="mt-4 space-y-2 border-t border-[#eee7dc] pt-4 text-sm">
                {quote.customerNotes && (
                  <p className="text-[#5c6b66]">
                    <span className="font-semibold text-[#122f2a]">
                      Customer notes:
                    </span>{" "}
                    {quote.customerNotes}
                  </p>
                )}
                {quote.internalNotes && (
                  <p className="whitespace-pre-line text-[#8b9793]">
                    <span className="font-semibold text-[#122f2a]">
                      Internal notes:
                    </span>{" "}
                    {quote.internalNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">
              Reject {quote?.quoteNumber}?
            </h3>
            <p className="mt-2 text-sm text-[#5c6b66]">
              The reason will be stored in the internal notes and the audit log.
            </p>
            <textarea
              rows={3}
              placeholder="Why is this quotation rejected?"
              className="mt-4 w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError("");
              }}
            />
            {reasonError && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {reasonError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setRejectOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={setStatus.isPending}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {setStatus.isPending ? "Saving…" : "Reject quotation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}