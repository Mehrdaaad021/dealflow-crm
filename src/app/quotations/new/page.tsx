"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";

type Line = {
  productId: number | undefined;
  description: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const aed = (v: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
  }).format(v);

export default function NewQuotationPage() {
  const router = useRouter();
  const companiesQ = api.companies.list.useQuery({});
  const dealsQ = api.deals.list.useQuery();
  const catalogQ = api.quotations.catalog.useQuery();

  const createQuote = api.quotations.create.useMutation({
    onSuccess: (quote) => {
      toast.success(`Draft ${quote.quoteNumber} created`);
      router.push("/quotations");
    },
    onError: (e) => toast.error(e.message),
  });

  const [companyId, setCompanyId] = useState("");
  const [dealId, setDealId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [quoteDiscount, setQuoteDiscount] = useState(0);
  const [customerNotes, setCustomerNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const companyDeals = (dealsQ.data ?? []).filter(
    (d) => String(d.companyId) === companyId,
  );

  const totals = useMemo(() => {
    const linesTotal = lines.reduce(
      (s, l) => s + round2(l.quantity * l.unitPrice - l.discount),
      0,
    );
    const subtotal = lines.reduce(
      (s, l) => s + round2(l.quantity * l.unitPrice),
      0,
    );
    const base = round2(linesTotal - quoteDiscount);
    const tax = round2(base * 0.05);
    return { subtotal: round2(subtotal), base, tax, total: round2(base + tax) };
  }, [lines, quoteDiscount]);

  const addFromCatalog = (productId: string) => {
    const product = (catalogQ.data ?? []).find((p) => String(p.id) === productId);
    if (!product) return;
    setLines([
      ...lines,
      {
        productId: product.id,
        description: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: Number(product.unitPrice),
        discount: 0,
        taxRate: Number(product.taxRate),
      },
    ]);
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const canSubmit =
    companyId !== "" && lines.length > 0 && !createQuote.isPending;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d3b]">
        Commercial document
      </p>
      <h1 className="mt-1 text-3xl font-bold text-[#122f2a]">New quotation</h1>
      <p className="mt-1 text-sm text-[#5c6b66]">
        Prices are snapshotted from the catalog; totals are calculated on the server.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="font-medium text-[#122f2a]">Company</span>
          <select
            className="mt-1 w-full rounded-md border border-[#e2dbd0] bg-white p-2"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setDealId("");
            }}
          >
            <option value="">Select company…</option>
            {(companiesQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.legalName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-[#122f2a]">Deal (optional)</span>
          <select
            className="mt-1 w-full rounded-md border border-[#e2dbd0] bg-white p-2"
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            disabled={!companyId}
          >
            <option value="">No deal</option>
            {companyDeals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-[#122f2a]">Valid until</span>
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-[#e2dbd0] bg-white p-2"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
            Line items
          </h2>
          <select
            aria-label="Add product from catalog"
            className="rounded-md border border-[#e2dbd0] bg-white p-2 text-sm"
            value=""
            onChange={(e) => addFromCatalog(e.target.value)}
          >
            <option value="">+ Add from catalog…</option>
            {(catalogQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({aed(Number(p.unitPrice))}/{p.unit})
              </option>
            ))}
          </select>
        </div>

        {lines.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[#d8cfc0] p-6 text-center text-sm text-[#8b9793]">
            No lines yet. Add a product from the catalog.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {lines.map((l, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border border-[#eee7dc] p-3 sm:grid-cols-12"
              >
                <input
                  aria-label="Description"
                  className="sm:col-span-4 rounded-md border border-[#e2dbd0] p-2 text-sm"
                  value={l.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                />
                <label className="sm:col-span-2 text-xs text-[#5c6b66]">
                  Qty
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2 text-sm"
                    value={l.quantity}
                    onChange={(e) =>
                      updateLine(i, { quantity: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="sm:col-span-2 text-xs text-[#5c6b66]">
                  Unit price
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2 text-sm"
                    value={l.unitPrice}
                    onChange={(e) =>
                      updateLine(i, { unitPrice: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="sm:col-span-2 text-xs text-[#5c6b66]">
                  Discount
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2 text-sm"
                    value={l.discount}
                    onChange={(e) =>
                      updateLine(i, { discount: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="sm:col-span-1 flex items-center justify-end text-sm font-semibold text-[#122f2a]">
                  {aed(round2(l.quantity * l.unitPrice - l.discount))}
                </div>
                <div className="sm:col-span-1 flex items-center justify-end">
                  <button
                    onClick={() => removeLine(i)}
                    className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium text-[#122f2a]">
              Quote-level discount (AED)
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
              value={quoteDiscount}
              onChange={(e) => setQuoteDiscount(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-[#122f2a]">Customer notes</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 rounded-lg bg-[#faf7f2] p-4 text-sm">
          <div className="flex justify-between text-[#5c6b66]">
            <span>Subtotal</span>
            <span>{aed(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#5c6b66]">
            <span>Discount</span>
            <span>− {aed(quoteDiscount)}</span>
          </div>
          <div className="flex justify-between text-[#5c6b66]">
            <span>VAT 5%</span>
            <span>{aed(totals.tax)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[#e2dbd0] pt-2 text-base font-bold text-[#122f2a]">
            <span>Total</span>
            <span>{aed(totals.total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-[#8b9793]">
            Preview only — the server recalculates and stores the authoritative totals.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => router.push("/quotations")}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() =>
              createQuote.mutate({
                companyId: Number(companyId),
                dealId: dealId ? Number(dealId) : undefined,
                validUntil: validUntil ? new Date(validUntil) : undefined,
                customerNotes: customerNotes || undefined,
                quoteDiscount,
                items: lines.map((l) => ({
                  productId: l.productId,
                  description: l.description,
                  sku: l.sku || undefined,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  taxRate: l.taxRate,
                })),
              })
            }
            className="rounded-md bg-[#1f6f5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
          >
            {createQuote.isPending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>
    </div>
  );
}