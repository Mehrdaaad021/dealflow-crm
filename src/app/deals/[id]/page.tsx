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
    maximumFractionDigits: 0,
  }).format(Number(v));

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const ACTIVITY_GLYPH: Record<string, string> = {
  call: "📞",
  meeting: "🤝",
  email: "✉️",
  messaging: "💬",
  note: "📝",
  demo: "🖥️",
  quotation_sent: "🧾",
  status_change: "🔁",
};

type ActivityType =
  | "call"
  | "meeting"
  | "email"
  | "messaging"
  | "note"
  | "demo"
  | "quotation_sent"
  | "status_change";

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const dealId = Number(params?.id);
  const enabled = Number.isInteger(dealId) && dealId > 0;

  const detailQ = api.deals.detail.useQuery({ id: dealId }, { enabled });
  const stagesQ = api.deals.stages.useQuery(undefined, { enabled });
  const timelineQ = api.deals.timeline.useQuery({ id: dealId }, { enabled });
  const historyQ = api.deals.history.useQuery({ id: dealId }, { enabled });
  const tasksQ = api.tasks.list.useQuery(undefined, { enabled });
  const utils = api.useUtils();

  const moveStage = api.deals.updateStage.useMutation({
    onSuccess: () => {
      void utils.deals.detail.invalidate();
      void utils.deals.timeline.invalidate();
      void utils.deals.history.invalidate();
      void utils.deals.list.invalidate();
      toast.success("Deal stage updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const createTask = api.tasks.create.useMutation({
    onSuccess: () => {
      void utils.tasks.list.invalidate();
      toast.success("Task created");
      setTaskOpen(false);
      setTaskForm({ title: "", dueAt: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const logActivity = api.activities.create.useMutation({
    onSuccess: () => {
      void utils.deals.timeline.invalidate();
      toast.success("Activity logged");
      setActivityOpen(false);
      setActivityForm({ type: "call", subject: "", body: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const completeTask = api.tasks.setStatus.useMutation({
    onSuccess: () => void utils.tasks.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [pendingMove, setPendingMove] = useState<{
    stageId: number;
    stageName: string;
    isLost: boolean;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", dueAt: "" });
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    type: "call" as ActivityType,
    subject: "",
    body: "",
  });

  const deal = detailQ.data;
  const stages = stagesQ.data ?? [];
  const dealTasks = (tasksQ.data ?? []).filter((t) => t.dealId === dealId);
  const terminal = deal?.stageIsTerminal ?? false;

  const requestMove = (stageId: number) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || !deal || stage.id === deal.stageId) return;
    const key = stage.name.trim().toLowerCase();
    if (stage.isTerminal || key === "won" || key === "lost") {
      setPendingMove({ stageId: stage.id, stageName: stage.name, isLost: key === "lost" });
      setLostReason("");
      setReasonError("");
    } else {
      moveStage.mutate({ id: dealId, stageId });
    }
  };

  const confirmMove = () => {
    if (!pendingMove) return;
    if (pendingMove.isLost && lostReason.trim().length === 0) {
      setReasonError("A lost reason is required.");
      return;
    }
    moveStage.mutate(
      {
        id: dealId,
        stageId: pendingMove.stageId,
        lostReason: pendingMove.isLost ? lostReason.trim() : undefined,
      },
      { onSettled: () => setPendingMove(null) },
    );
  };

  const wonStage = stages.find((s) => s.name.trim().toLowerCase() === "won");
  const lostStage = stages.find((s) => s.name.trim().toLowerCase() === "lost");

  if (!enabled) {
    return (
      <div className="p-10 text-center text-sm text-[#5c6b66]">
        Invalid deal id.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-4 text-sm text-[#5c6b66]">
          <Link href="/pipeline" className="hover:text-[#1f6f5c]">
            Pipeline
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#122f2a]">{deal?.name ?? "…"}</span>
        </nav>

        {detailQ.isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-white/70" />
        ) : !deal ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-[#122f2a]">
              Deal not found or access denied
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-[#122f2a]">
                      {deal.name}
                    </h1>
                    <span className="flex items-center gap-1.5 rounded-full bg-[#122f2a]/10 px-3 py-1 text-xs font-semibold text-[#122f2a]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: deal.stageColor ?? "#94a3b8" }}
                      />
                      {deal.stageName ?? "No stage"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#5c6b66]">
                    <Link
                      href={`/companies/${deal.companyId}`}
                      className="underline decoration-[#d8cfc0] underline-offset-2 hover:text-[#1f6f5c]"
                    >
                      {deal.companyName}
                    </Link>
                    {deal.contactName && <span> · {deal.contactName}</span>}
                    <span> · {deal.ownerName ?? deal.ownerEmail}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#122f2a]">
                    {aed(deal.amount)}
                  </p>
                  <p className="text-xs text-[#5c6b66]">
                    {deal.probability}% probability
                    {deal.expectedCloseDate && ` · close ${deal.expectedCloseDate}`}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#eee7dc] pt-4">
                <select
                  aria-label="Move deal to stage"
                  disabled={terminal}
                  className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm text-[#122f2a] disabled:opacity-50"
                  value={deal.stageId ?? ""}
                  onChange={(e) => requestMove(Number(e.target.value))}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {!terminal && wonStage && (
                  <button
                    onClick={() => requestMove(wonStage.id)}
                    className="rounded-md bg-[#1f6f5c] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#185a4b]"
                  >
                    Mark won
                  </button>
                )}
                {!terminal && lostStage && (
                  <button
                    onClick={() => requestMove(lostStage.id)}
                    className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
                  >
                    Mark lost
                  </button>
                )}
                {terminal && (
                  <span className="rounded-md bg-[#122f2a]/10 px-3 py-1.5 text-sm font-medium text-[#122f2a]">
                    Closed {deal.stageName}
                    {deal.wonLostAt ? ` on ${fmtDateTime(new Date(deal.wonLostAt))}` : ""}
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => setActivityOpen(true)}
                    className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm font-medium text-[#122f2a] hover:bg-[#f1ede5]"
                  >
                    Log activity
                  </button>
                  <button
                    onClick={() => setTaskOpen(true)}
                    className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm font-medium text-[#122f2a] hover:bg-[#f1ede5]"
                  >
                    Create task
                  </button>
                  <Link
                    href="/quotations"
                    className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm font-medium text-[#122f2a] hover:bg-[#f1ede5]"
                  >
                    Create quotation
                  </Link>
                </div>
              </div>

              {deal.lostReason && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  Lost reason: {deal.lostReason}
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
                    Activity timeline
                  </h2>
                  {timelineQ.isLoading ? (
                    <div className="mt-4 h-32 animate-pulse rounded-lg bg-[#f1ede5]" />
                  ) : (timelineQ.data ?? []).length === 0 ? (
                    <p className="mt-4 text-sm text-[#8b9793]">
                      No activities yet. Log the first touchpoint.
                    </p>
                  ) : (
                    <ol className="mt-4 space-y-4">
                      {(timelineQ.data ?? []).map((a) => (
                        <li key={a.id} className="flex gap-3">
                          <span className="text-lg">{ACTIVITY_GLYPH[a.type] ?? "•"}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#122f2a]">
                              {a.subject}
                            </p>
                            {a.body && (
                              <p className="mt-0.5 text-sm text-[#5c6b66]">{a.body}</p>
                            )}
                            <p className="mt-0.5 text-xs text-[#8b9793]">
                              {fmtDateTime(new Date(a.activityAt))} ·{" "}
                              {a.createdByName ?? a.creatorEmail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
                    Tasks
                  </h2>
                  {dealTasks.length === 0 ? (
                    <p className="mt-4 text-sm text-[#8b9793]">No tasks on this deal.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {dealTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-3">
                          <button
                            aria-label={
                              t.status === "completed" ? "Reopen task" : "Complete task"
                            }
                            onClick={() =>
                              completeTask.mutate({
                                id: t.id,
                                status: t.status === "completed" ? "open" : "completed",
                              })
                            }
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                              t.status === "completed"
                                ? "border-[#1f6f5c] bg-[#1f6f5c] text-white"
                                : "border-[#c9c0b2] text-transparent hover:border-[#1f6f5c]"
                            }`}
                          >
                            ✓
                          </button>
                          <span
                            className={`text-sm ${
                              t.status === "completed"
                                ? "text-[#8b9793] line-through"
                                : "text-[#122f2a]"
                            }`}
                          >
                            {t.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6b66]">
                  Audit history
                </h2>
                {historyQ.isLoading ? (
                  <div className="mt-4 h-32 animate-pulse rounded-lg bg-[#f1ede5]" />
                ) : (historyQ.data ?? []).length === 0 ? (
                  <p className="mt-4 text-sm text-[#8b9793]">
                    No audited changes yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {(historyQ.data ?? []).map((h) => (
                      <li key={h.id} className="text-sm">
                        <p className="font-medium text-[#122f2a]">{h.action}</p>
                        <p className="text-xs text-[#8b9793]">
                          {fmtDateTime(new Date(h.createdAt))} ·{" "}
                          {h.actorName ?? h.actorEmail}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">
              Mark “{deal?.name}” as {pendingMove.stageName}?
            </h3>
            <p className="mt-2 text-sm text-[#5c6b66]">
              {pendingMove.isLost
                ? "Closing as Lost requires a reason. It will be stored on the deal and in the audit log."
                : "The deal will be closed as Won with today's date and its current value."}
            </p>
            {pendingMove.isLost && (
              <div className="mt-4">
                <textarea
                  rows={3}
                  placeholder="Why was this deal lost?"
                  className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  value={lostReason}
                  onChange={(e) => {
                    setLostReason(e.target.value);
                    setReasonError("");
                  }}
                />
                {reasonError && (
                  <p className="mt-1 text-xs font-medium text-red-600">{reasonError}</p>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingMove(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={confirmMove}
                disabled={moveStage.isPending}
                className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  pendingMove.isLost
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-[#1f6f5c] hover:bg-[#185a4b]"
                }`}
              >
                {moveStage.isPending ? "Saving…" : `Confirm ${pendingMove.stageName}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">New task on this deal</h3>
            <div className="mt-4 space-y-3">
              <input
                placeholder="What needs to happen?"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              />
              <input
                type="datetime-local"
                aria-label="Due date"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm"
                value={taskForm.dueAt}
                onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setTaskOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createTask.mutate({
                    title: taskForm.title,
                    dueAt: taskForm.dueAt ? new Date(taskForm.dueAt) : undefined,
                    dealId,
                    companyId: deal?.companyId,
                  })
                }
                disabled={createTask.isPending || taskForm.title.trim().length === 0}
                className="rounded-md bg-[#1f6f5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
              >
                {createTask.isPending ? "Saving…" : "Create task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activityOpen && deal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">Log activity</h3>
            <div className="mt-4 space-y-3">
              <select
                aria-label="Activity type"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm"
                value={activityForm.type}
                onChange={(e) =>
                  setActivityForm({
                    ...activityForm,
                    type: e.target.value as ActivityType,
                  })
                }
              >
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
                <option value="messaging">Messaging</option>
                <option value="note">Note</option>
                <option value="demo">Demo</option>
              </select>
              <input
                placeholder="Subject"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]"
                value={activityForm.subject}
                onChange={(e) =>
                  setActivityForm({ ...activityForm, subject: e.target.value })
                }
              />
              <textarea
                rows={3}
                placeholder="Notes"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]"
                value={activityForm.body}
                onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActivityOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  logActivity.mutate({
                    companyId: deal.companyId,
                    dealId,
                    type: activityForm.type,
                    subject: activityForm.subject,
                    body: activityForm.body || undefined,
                    occurredAt: new Date(),
                  })
                }
                disabled={logActivity.isPending || activityForm.subject.trim().length === 0}
                className="rounded-md bg-[#1f6f5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
              >
                {logActivity.isPending ? "Saving…" : "Save activity"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}