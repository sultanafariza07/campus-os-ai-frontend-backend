import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeft,
  HiOutlineClipboardList,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineTrash,
  HiCheckCircle,
  HiOutlineCheckCircle,
  HiOutlineRefresh,
} from "react-icons/hi";
import { api, ApiRequestError } from "../lib/api";
import { SkeletonRow } from "./components/Skeleton";
import { Toast, type ToastKind } from "./components/Toast";

// Backend has always had full CRUD for tasks (see Backend/src/routes/tasks.routes.ts) —
// this page was a "Coming Soon" placeholder through Phase 13. Phase 14 asked
// for real search/filter/sort/validation, which a placeholder can't provide,
// so this is now a full implementation built directly on the existing
// api.tasks.* module (no backend changes needed here).

type Task = {
  id: number;
  title: string;
  dueDate: string | null;
  completed: boolean;
};

type StatusFilter = "all" | "pending" | "completed";
type SortBy = "due" | "title" | "newest";

function formatDue(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TasksPage() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("due");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newTitleError, setNewTitleError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.tasks.list();
      setTasks(
        res.tasks.map((t: any) => ({
          id: Number(t.id),
          title: String(t.title),
          dueDate: (t.dueDate ?? t.due_date ?? null) as string | null,
          completed: Boolean(t.completed),
        }))
      );
    } catch (e: unknown) {
      if (e instanceof ApiRequestError && e.status === 401) return;
      setError(e instanceof Error ? e.message : "Couldn’t load tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const visibleTasks = useMemo(() => {
    let list = tasks;

    if (statusFilter === "pending") list = list.filter((t) => !t.completed);
    if (statusFilter === "completed") list = list.filter((t) => t.completed);

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q));

    const sorted = [...list];
    if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "due") {
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else {
      sorted.sort((a, b) => b.id - a.id);
    }
    return sorted;
  }, [tasks, search, statusFilter, sortBy]);

  const pendingCount = tasks.filter((t) => !t.completed).length;

  const toggleTask = async (id: number) => {
    const current = tasks.find((t) => t.id === id);
    const nextCompleted = !current?.completed;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted } : t)));
    try {
      await api.tasks.update(id, { completed: nextCompleted });
    } catch (e: unknown) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !nextCompleted } : t)));
      if (!(e instanceof ApiRequestError && e.status === 401)) {
        setToast({ kind: "error", text: "Couldn’t update task" });
      }
    }
  };

  const deleteTask = async (id: number) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.tasks.delete(id);
      setToast({ kind: "success", text: "Task deleted" });
    } catch (e: unknown) {
      if (!(e instanceof ApiRequestError && e.status === 401)) {
        setTasks(previous);
        setToast({ kind: "error", text: "Couldn’t delete task" });
      }
    }
  };

  const addTask = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setNewTitleError("Title is required");
      return;
    }
    if (trimmed.length > 255) {
      setNewTitleError("Title must be 255 characters or fewer");
      return;
    }

    setAdding(true);
    try {
      const res = await api.tasks.create({ title: trimmed, due_date: newDue || undefined });
      const created: Task = {
        id: Number(res.task.id),
        title: String(res.task.title),
        dueDate: (res.task.dueDate ?? null) as string | null,
        completed: Boolean(res.task.completed),
      };
      setTasks((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDue("");
      setNewTitleError(null);
      setShowAddForm(false);
      setToast({ kind: "success", text: "Task added" });
    } catch (e: unknown) {
      if (!(e instanceof ApiRequestError && e.status === 401)) {
        setToast({ kind: "error", text: e instanceof Error ? e.message : "Couldn’t add task" });
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] px-4 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-110px] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.14) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {toast && <Toast kind={toast.kind} text={toast.text} />}

      <div className="relative mx-auto max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
              Assignments
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              {loading ? "Loading…" : `${pendingCount} pending`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
          >
            <HiOutlineArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {!loading && !error && tasks.length > 0 && (
          <>
            {/* Search */}
            <div className="relative">
              <HiOutlineSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5563]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-[#E2E8F0] placeholder-[#4B5563] outline-none transition-colors focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
                >
                  <HiOutlineX className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter + sort */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                {(["all", "pending", "completed"] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      statusFilter === f ? "bg-[#F59E0B]/15 text-[#F59E0B]" : "text-[#64748B] hover:text-[#94A3B8]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Sort tasks"
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-[#E2E8F0] outline-none focus:border-[#F59E0B]"
              >
                <option value="due">Due date</option>
                <option value="title">Title</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </>
        )}

        {/* Add task form */}
        {showAddForm ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4 shadow-xl space-y-3">
            <div>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (newTitleError) setNewTitleError(null);
                }}
                placeholder="Task title"
                className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-[#E2E8F0] placeholder-[#3B4558] outline-none transition-colors focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 ${
                  newTitleError ? "border-red-500/60" : "border-white/10"
                }`}
              />
              {newTitleError && <p className="mt-1.5 text-xs text-red-400">{newTitleError}</p>}
            </div>
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#E2E8F0] outline-none transition-colors focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTitle("");
                  setNewDue("");
                  setNewTitleError(null);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#94A3B8] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addTask}
                disabled={adding}
                className="flex-1 rounded-xl bg-[#F59E0B] py-2.5 text-sm font-semibold text-[#1A1206] shadow-lg shadow-[#F59E0B]/20 hover:bg-[#FBBF24] transition-colors disabled:opacity-60"
              >
                {adding ? "Adding…" : "Add task"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] py-3 text-sm font-medium text-[#94A3B8] hover:border-[#F59E0B]/40 hover:text-[#F59E0B] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
          >
            <HiOutlinePlus className="w-4 h-4" /> Add task
          </button>
        )}

        {/* Content */}
        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 shadow-xl">
            <p className="text-sm font-semibold text-red-200">Couldn’t load tasks</p>
            <p className="mt-1 text-xs text-red-200/80">{error}</p>
            <button
              type="button"
              onClick={fetchTasks}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#6C63FF] px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-[#6C63FF]/20 hover:bg-[#7C6FFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
            >
              <HiOutlineRefresh className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F59E0B]/12 ring-1 ring-[#F59E0B]/20">
              <HiOutlineClipboardList className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-white">No tasks yet</p>
            <p className="mt-2 text-xs text-[#64748B]">Add your first assignment to get started.</p>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-white">No matching tasks</p>
            <p className="mt-2 text-xs text-[#64748B]">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
            {visibleTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                  className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] rounded-full"
                >
                  {task.completed ? (
                    <HiCheckCircle className="w-5 h-5 text-[#F59E0B]" />
                  ) : (
                    <HiOutlineCheckCircle className="w-5 h-5 text-[#3B4558] hover:text-[#F59E0B] transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug ${task.completed ? "line-through text-[#3B4558]" : "text-[#E2E8F0]"}`}>
                    {task.title}
                  </p>
                  {task.dueDate && (
                    <p className="mt-1 text-xs text-[#4B5563]">Due {formatDue(task.dueDate)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  aria-label="Delete task"
                  className="mt-0.5 shrink-0 text-[#4B5563] hover:text-red-400 transition-colors"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
