"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";

type TaskRow = {
  id: number;
  title: string;
  dueAt: Date | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "completed" | "cancelled";
  reminder: boolean;
  companyId: number | null;
  companyName: string | null;
  dealId: number | null;
  dealName: string | null;
  leadName: string | null;
  assignedToId: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

const PRIORITY_META: Record<
  TaskRow["priority"],
  { glyph: string; label: string; cls: string }
> = {
  urgent: { glyph: "‼", label: "Urgent", cls: "bg-red-100 text-red-800" },
  high: { glyph: "▲", label: "High", cls: "bg-orange-100 text-orange-800" },
  medium: { glyph: "◆", label: "Medium", cls: "bg-amber-100 text-amber-800" },
  low: { glyph: "○", label: "Low", cls: "bg-slate-100 text-slate-700" },
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

type Tab = "overdue" | "today" | "upcoming" | "completed" | "all";

export default function TasksPage() {
  const tasksQ = api.tasks.list.useQuery();
  const usersQ = api.tasks.assignableUsers.useQuery();
  const companiesQ = api.companies.list.useQuery({});
  const utils = api.useUtils();

  const setStatus = api.tasks.setStatus.useMutation({
    onSuccess: () => void utils.tasks.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const createTask = api.tasks.create.useMutation({
    onSuccess: () => {
      void utils.tasks.list.invalidate();
      toast.success("Task created");
      setShowCreate(false);
      setForm({ title: "", dueAt: "", priority: "medium", companyId: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const [tab, setTab] = useState<Tab>("overdue");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    dueAt: "",
    priority: "medium" as TaskRow["priority"],
    companyId: "",
  });

  const tasks = (tasksQ.data ?? []) as TaskRow[];
  const isManager = usersQ.data && usersQ.data.length > 1;

  const buckets = useMemo(() => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const openish = (t: TaskRow) =>
      t.status === "open" || t.status === "in_progress";
    return {
      overdue: tasks.filter((t) => openish(t) && t.dueAt && t.dueAt < now),
      today: tasks.filter(
        (t) => openish(t) && t.dueAt && t.dueAt >= now && t.dueAt <= endOfDay,
      ),
      upcoming: tasks.filter((t) => openish(t) && t.dueAt && t.dueAt > endOfDay),
      completed: tasks.filter((t) => t.status === "completed"),
      all: tasks,
    } satisfies Record<Tab, TaskRow[]>;
  }, [tasks]);

  const visible = buckets[tab].filter((t) => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (ownerFilter !== "all" && t.assignedToId !== ownerFilter) return false;
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d3b]">
              Follow-up center
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[#122f2a]">Tasks</h1>
            <p className="mt-1 text-sm text-[#5c6b66]">
              Everything you promised to do, in one calm list.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-[#122f2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2420]"
          >
            + New task
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[#122f2a] text-white"
                  : "bg-white text-[#122f2a] shadow-sm hover:bg-[#f1ede5]"
              }`}
            >
              {t.label}
              <span className="ml-2 text-xs opacity-70">
                {buckets[t.key].length}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select
            aria-label="Filter by priority"
            className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm text-[#122f2a]"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {isManager && (
            <select
              aria-label="Filter by owner"
              className="rounded-md border border-[#e2dbd0] bg-white px-3 py-1.5 text-sm text-[#122f2a]"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="all">All owners</option>
              {(usersQ.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          )}
        </div>

        {tasksQ.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/70" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-[#122f2a]">Nothing here</p>
            <p className="mt-1 text-sm text-[#5c6b66]">
              {tab === "overdue"
                ? "No overdue follow-ups. Enjoy the calm."
                : "No tasks in this bucket yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((t) => {
              const meta = PRIORITY_META[t.priority];
              const overdue =
                (t.status === "open" || t.status === "in_progress") &&
                t.dueAt &&
                t.dueAt < new Date();
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm"
                >
                  <button
                    aria-label={
                      t.status === "completed" ? "Reopen task" : "Complete task"
                    }
                    onClick={() =>
                      setStatus.mutate({
                        id: t.id,
                        status: t.status === "completed" ? "open" : "completed",
                      })
                    }
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      t.status === "completed"
                        ? "border-[#1f6f5c] bg-[#1f6f5c] text-white"
                        : "border-[#c9c0b2] text-transparent hover:border-[#1f6f5c]"
                    }`}
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        t.status === "completed"
                          ? "text-[#8b9793] line-through"
                          : "text-[#122f2a]"
                      }`}
                    >
                      {t.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5c6b66]">
                      {t.companyName && (
                        <Link
                          href={`/companies/${t.companyId}`}
                          className="underline decoration-[#d8cfc0] underline-offset-2 hover:text-[#1f6f5c]"
                        >
                          {t.companyName}
                        </Link>
                      )}
                      {t.dealName && <span>Deal: {t.dealName}</span>}
                      {t.leadName && <span>Lead: {t.leadName}</span>}
                      {t.dueAt && (
                        <span className={overdue ? "font-semibold text-red-700" : ""}>
                          {overdue ? "Overdue: " : "Due: "}
                          {fmtDate(t.dueAt)}
                        </span>
                      )}
                      <span className={meta.cls} title={meta.label}>
                        {meta.glyph} {meta.label}
                      </span>
                      <span title={t.assigneeName ?? t.assigneeEmail ?? ""}>
                        {(t.assigneeName ?? t.assigneeEmail ?? "?")
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#122f2a]">New task</h3>
            <div className="mt-4 space-y-3">
              <input
                placeholder="What needs to happen?"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <div className="flex gap-3">
                <input
                  type="datetime-local"
                  aria-label="Due date"
                  className="flex-1 rounded-md border border-[#e2dbd0] p-2 text-sm"
                  value={form.dueAt}
                  onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                />
                <select
                  aria-label="Priority"
                  className="rounded-md border border-[#e2dbd0] p-2 text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value as TaskRow["priority"],
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <select
                aria-label="Related company"
                className="w-full rounded-md border border-[#e2dbd0] p-2 text-sm"
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              >
                <option value="">No company</option>
                {(companiesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b66] hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createTask.mutate({
                    title: form.title,
                    dueAt: form.dueAt ? new Date(form.dueAt) : undefined,
                    priority: form.priority,
                    companyId: form.companyId ? Number(form.companyId) : undefined,
                  })
                }
                disabled={createTask.isPending || form.title.trim().length === 0}
                className="rounded-md bg-[#1f6f5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#185a4b] disabled:opacity-60"
              >
                {createTask.isPending ? "Saving…" : "Create task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}