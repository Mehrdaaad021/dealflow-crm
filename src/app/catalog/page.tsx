"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

const aed = (v: string | number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
  }).format(Number(v));

export default function CatalogPage() {
  const listQ = api.products.list.useQuery();
  const meQ = api.products.me.useQuery();
  const utils = api.useUtils();

  const isManager =
    meQ.data?.role === "sales_manager" || meQ.data?.role === "admin";

  const createProduct = api.products.create.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      toast.success("Product added to catalog");
      setCreateOpen(false);
      setForm({
        name: "",
        sku: "",
        unit: "unit",
        unitPrice: "",
        taxRate: "5",
        category: "",
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePrice = api.products.updatePrice.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      toast.success("Price updated and audited");
      setEditTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const setStatus = api.products.setStatus.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      toast.success("Product status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "unit",
    unitPrice: "",
    taxRate: "5",
    category: "",
  });
  const [editTarget, setEditTarget] = useState<{
    id: number;
    name: string;
    price: number;
  } | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const rows = listQ.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d3b]">
            Products & services
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#122f2a]">Catalog</h1>
          <p className="mt-1 text-sm text-[#5c6b66]">
            The price source of truth for quotations. Price changes are audited.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-[#122f2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2420]"
          >
            + New product
          </button>
        )}
      </div>

      {!isManager && !meQ.isLoading && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You have read-only access to the catalog. Price management requires a
          sales manager or admin.
        </p>
      )}

      {listQ.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-white/70" />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#eee7dc] text-xs uppercase tracking-wider text-[#5c6b66]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Unit price</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3">Status</th>
                {isManager && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1ede5]">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-[#faf7f2]">
                  <td className="px-4 py-3 font-semibold text-[#122f2a]">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-[#8b9793]">{p.sku}</td>
                  <td className="px-4 py-3 text-[#5c6b66]">
                    {p.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#5c6b66]">{p.unit}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#122f2a]">
                    {aed(p.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#5c6b66]">
                    {p.taxRate}%
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditTarget({
                              id: p.id,
                              name: p.name,
                              price: Number(p.unitPrice),
                            });
                            setEditPrice(String(Number(p.unitPrice)));
                          }}
                          className="rounded-md border border-[#e2dbd0] bg-white px-2.5 py-1 text-xs font-medium text-[#122f2a] hover:bg-[#f1ede5]"
                        >
                          Edit price
                        </button>
                        <button
                          onClick={() =>
                            setStatus.mutate({
                              id: p.id,
                              status: p.status === "active" ? "inactive" : "active",
                            })
                          }
                          className="rounded-md border border-[#e2dbd0] bg-white px-2.5 py-1 text-xs font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
                        >
                          {p.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">New product</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="font-medium text-[#122f2a]">Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-[#122f2a]">SKU</span>
                <input
                  className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-[#122f2a]">Category</span>
                <input
                  className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-[#122f2a]">Unit</span>
                <input
                  className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-[#122f2a]">
                  Unit price (AED)
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-[#122f2a]">VAT %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="mt-1 w-full rounded-md border border-[#e2dbd0] p-2"
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                disabled={
                  createProduct.isPending ||
                  form.name.trim().length === 0 ||
                  form.sku.trim().length === 0 ||
                  form.unitPrice === ""
                }
                onClick={() =>
                  createProduct.mutate({
                    name: form.name,
                    sku: form.sku,
                    unit: form.unit,
                    unitPrice: Number(form.unitPrice),
                    taxRate: Number(form.taxRate),
                    category: form.category || undefined,
                  })
                }
                className="rounded-md bg-[#1f6f5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
              >
                {createProduct.isPending ? "Saving…" : "Create product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">
              New price for {editTarget.name}
            </h3>
            <p className="mt-1 text-sm text-[#5c6b66]">
              Current: {aed(editTarget.price)} — the change will be written to
              the audit log.
            </p>
            <input
              type="number"
              min={0}
              step={0.01}
              className="mt-4 w-full rounded-md border border-[#e2dbd0] p-2"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                disabled={updatePrice.isPending || editPrice === ""}
                onClick={() =>
                  updatePrice.mutate({
                    id: editTarget.id,
                    unitPrice: Number(editPrice),
                  })
                }
                className="rounded-md bg-[#1f6f5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
              >
                {updatePrice.isPending ? "Saving…" : "Update price"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}