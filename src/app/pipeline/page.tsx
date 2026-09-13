"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";

type DealRow = {
  id: number;
  name: string;
  amount: string;
  probability: number;
  expectedCloseDate: string | null;
  lostReason: string | null;
  stageId: number | null;
  companyId: number;
  companyName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  overdueTasks: number;
  nextTaskDueAt: Date | null;
  createdAt: Date;
};

const aed = (v: string | number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(Number(v));

const initials = (name: string | null, email: string | null) => {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
};

export default function PipelinePage() {
  const stagesQ = api.deals.stages.useQuery();
  const dealsQ = api.deals.list.useQuery();
  const utils = api.useUtils();

  const moveStage = api.deals.updateStage.useMutation({
    onSuccess: () => {
      void utils.deals.list.invalidate();
      toast.success("Deal stage updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const [pending, setPending] = useState<{
    dealId: number;
    dealName: string;
    stageId: number;
    stageName: string;
    isLost: boolean;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const stages = stagesQ.data ?? [];
  const deals = (dealsQ.data ?? []) as DealRow[];

  const byStage = useMemo(() => {
    const map = new Map<number, DealRow[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of deals) {
      if (d.stageId == null) continue;
      if (!map.has(d.stageId)) map.set(d.stageId, []);
      map.get(d.stageId)!.push(d);
    }
    return map;
  }, [stages, deals]);

  const openStages = stages.filter((s) => !s.isTerminal);
  const openDeals = deals.filter((d) =>
    openStages.some((s) => s.id === d.stageId),
  );
  const openTotal = openDeals.reduce((s, d) => s + Number(d.amount), 0);
  const weightedTotal = openDeals.reduce(
    (s, d) => s + (Number(d.amount) * d.probability) / 100,
    0,
  );

  const requestMove = (deal: DealRow, stageId: number) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || stage.id === deal.stageId) return;
    const key = stage.name.trim().toLowerCase();
    if (stage.isTerminal || key === "won" || key === "lost") {
      setPending({
        dealId: deal.id,
        dealName: deal.name,
        stageId: stage.id,
        stageName: stage.name,
        isLost: key === "lost",
      });
      setLostReason("");
      setReasonError("");
    } else {
      moveStage.mutate({ id: deal.id, stageId });
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.isLost && lostReason.trim().length === 0) {
      setReasonError("A lost reason is required before closing a deal as Lost.");
      return;
    }
    moveStage.mutate(
      {
        id: pending.dealId,
        stageId: pending.stageId,
        lostReason: pending.isLost ? lostReason.trim() : undefined,
      },
      { onSettled: () => setPending(null) },
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d3b]">
            Revenue pipeline
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#122f2a]">Pipeline</h1>
          <p className="mt-1 text-sm text-[#5c6b66]">
            Drag deals between stages, or use the move menu on each card.
          </p>
        </div>
        <div className="flex gap-8 rounded-xl bg-white px-6 py-4 shadow-sm">
          <div>
            <p className="text-xs text-[#5c6b66]">Open pipeline</p>
            <p className="text-xl font-bold text-[#122f2a]">{aed(openTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-[#5c6b66]">Weighted</p>
            <p className="text-xl font-bold text-[#1f6f5c]">
              {aed(weightedTotal)}
            </p>
          </div>
        </div>
      </div>

      {stagesQ.isLoading || dealsQ.isLoading ? (
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-96 w-72 animate-pulse rounded-xl bg-white/70"
            />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center text-[#5c6b66] shadow-sm">
          No pipeline stages configured yet.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {stages.map((stage) => {
            const items = byStage.get(stage.id) ?? [];
            const total = items.reduce((s, d) => s + Number(d.amount), 0);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = Number(e.dataTransfer.getData("text/deal-id"));
                  const deal = deals.find((d) => d.id === id);
                  if (deal) requestMove(deal, stage.id);
                }}
                className={`flex w-72 shrink-0 flex-col rounded-xl bg-white/70 shadow-sm ${
                  stage.isTerminal ? "opacity-90" : ""
                }`}
              >
                <div className="border-b border-[#eee7dc] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color ?? "#94a3b8" }}
                    />
                    <h2 className="text-sm font-semibold text-[#122f2a]">
                      {stage.name}
                    </h2>
                    <span className="ml-auto rounded-full bg-[#122f2a]/10 px-2 py-0.5 text-xs font-medium text-[#122f2a]">
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#5c6b66]">
                    {aed(total)}
                    {stage.isTerminal ? " closed" : " in stage"}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#d8cfc0] p-4 text-center text-xs text-[#8b9793]">
                      Drop a deal here
                    </p>
                  )}
                  {items.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/deal-id", String(d.id))
                      }
                      className="cursor-grab rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#122f2a]">
                          <Link
                            href={`/deals/${d.id}`}
                            className="hover:underline hover:decoration-[#1f6f5c] hover:underline-offset-2"
                          >
                            {d.name}
                          </Link>
                        </p>
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f6f5c]/15 text-[10px] font-bold text-[#1f6f5c]"
                          title={d.ownerName ?? d.ownerEmail ?? "Unassigned"}
                        >
                          {initials(d.ownerName, d.ownerEmail)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#5c6b66]">
                        {d.companyName ?? "—"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-[#122f2a]">
                          {aed(d.amount)}
                        </p>
                        <p className="text-xs text-[#5c6b66]">
                          {d.probability}%
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5c6b66]">
                        {d.expectedCloseDate && (
                          <span>Close: {d.expectedCloseDate}</span>
                        )}
                        {d.overdueTasks > 0 && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">
                            ⚠ {d.overdueTasks} overdue
                          </span>
                        )}
                      </div>
                      <select
                        aria-label={`Move ${d.name} to another stage`}
                        className="mt-2 w-full rounded-md border border-[#e2dbd0] bg-white px-2 py-1 text-xs text-[#122f2a] focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]"
                        value={d.stageId ?? ""}
                        onChange={(e) => requestMove(d, Number(e.target.value))}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">
              Mark “{pending.dealName}” as {pending.stageName}?
            </h3>
            <p className="mt-2 text-sm text-[#5c6b66]">
              {pending.isLost
                ? "Closing as Lost requires a reason. This will be stored on the deal and in the audit log."
                : "The deal will be closed as Won with today's date and its current value."}
            </p>
            {pending.isLost && (
              <div className="mt-4">
                <textarea
                  rows={3}
                  placeholder="Why was this deal lost? (pricing, competitor, timing…)"
                  className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  value={lostReason}
                  onChange={(e) => {
                    setLostReason(e.target.value);
                    setReasonError("");
                  }}
                />
                {reasonError && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {reasonError}
                  </p>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPending(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={confirmPending}
                disabled={moveStage.isPending}
                className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  pending.isLost
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-[#1f6f5c] hover:bg-[#185a4b]"
                }`}
              >
                {moveStage.isPending ? "Saving…" : `Confirm ${pending.stageName}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}