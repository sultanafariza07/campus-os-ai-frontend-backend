import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError, type NotificationItem, type UserProfileDto } from "../lib/api";

import { ACTIVITIES } from "../data/activity";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import NotificationBell from "./components/NotificationBell";
import { SkeletonRow } from "./components/Skeleton";




import {
  HiSparkles,
  HiOutlineDocumentText,
  HiOutlineClipboardList,
  HiOutlineAcademicCap,
  HiOutlineCalendar,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineLightningBolt,
  HiOutlineFire,
  HiCheckCircle,
  HiOutlineBookOpen,
  HiOutlineBell,
} from "react-icons/hi";

// The dashboard's local view of the signed-in user is just the backend's
// profile DTO (see lib/api.ts) — kept as a type alias rather than a
// hand-copied interface so the two can never drift out of sync again.
type UserProfile = UserProfileDto;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: number;
  title: string;
  due: string;
  done: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const USER_FALLBACK = {
  name: "Student",
  branch: "Not set",
  year: "Not set",
  streak: 7,
  tasksCompleted: 0,
  notesCreated: 0,
  aiChats: 0,
};

// (Phase 14: removed the hardcoded mock TASKS array that used to seed
// initial state — it caused a brief flash of fake tasks before the real
// list loaded. The Upcoming Tasks section now shows a proper skeleton
// instead while loading.)



// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-widest">{title}</h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-0.5 text-xs text-[#6C63FF] hover:text-[#A5A0FF] transition-colors focus-visible:outline-none focus-visible:underline"
        >
          {action} <HiOutlineChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  sub,
  accent,
  glow,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  accent: string;
  glow: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#111118] p-4 text-left shadow-lg transition-all hover:border-white/[0.12] hover:bg-[#16161F] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] overflow-hidden"
    >
      {/* Hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ background: glow }}
      />
      <span
        className="relative flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: accent + "18" }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </span>
      <div className="relative">
        <p className="text-sm font-semibold text-[#E2E8F0] leading-tight">{label}</p>
        <p className="text-xs text-[#4B5563] mt-0.5">{sub}</p>
      </div>
    </button>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: number) => void }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? "Mark incomplete" : "Mark complete"}
        className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] rounded-full"
      >
        {task.done ? (
          <HiCheckCircle className="w-5 h-5 text-[#6C63FF]" />
        ) : (
          <HiOutlineCheckCircle className="w-5 h-5 text-[#3B4558] hover:text-[#6C63FF] transition-colors" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.done ? "line-through text-[#3B4558]" : "text-[#E2E8F0]"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {!task.done && (
            <>
              <span className="text-[#2D3748]">·</span>
              <span className="flex items-center gap-1 text-xs text-[#4B5563]">
                <HiOutlineClock className="w-3 h-3" /> {task.due}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState(USER_FALLBACK);
  const [notesCount, setNotesCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => { 
      // 1) Load profile (name) so header reflects backend auth.
      try {
        const p = await api.auth.profile();
        if (mounted) {
          setProfile(p.user);
          // Backend profile DTO may not include stats; dashboard uses real notesCount + fallback stats.
          setStats((prev) => ({
            ...prev,
            ...(p.user.stats ?? {}),
          }));
        }
      } catch {
        // Non-fatal here: if the token is actually invalid, the tasks call
        // right below will get the 401 and the global AuthEventHandler
        // (see App.tsx) will clear the token and redirect to Login.
      }
    
      try {
        setLoading(true);
        setError(null);
        const res = await api.tasks.list();
        const mapped: Task[] = res.tasks.map((t: any) => ({
          id: Number(t.id),
          title: String(t.title),
          due: String(t.dueDate ?? t.due_date ?? ''),
          done: Boolean(t.completed),
        }));

        if (mounted) setTasks(mapped);
      } catch (e: unknown) {
        if (!mounted) return;
        // 401s are handled centrally (token cleared + redirect in flight);
        // avoid flashing an inline error while that happens.
        if (e instanceof ApiRequestError && e.status === 401) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }

      // 3) Real notes count for the stats card — the backend never actually
      // populates profile.stats, so this was always hardcoded to 0 before.
      try {
        const notesRes = await api.notes.list();
        if (mounted) setNotesCount(notesRes.notes.length);
      } catch {
        // Non-fatal — stats card just falls back to showing 0.
      }

      // 4) Recent notifications preview for the dashboard card.
      try {
        const notifRes = await api.notifications.list({ limit: 3 });
        if (mounted) setNotifications(notifRes.notifications);
      } catch {
        // Non-fatal — section just renders its empty state.
      } finally {
        if (mounted) setNotificationsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const toggleTask = async (id: number) => {
    const current = tasks.find((t) => t.id === id);
    const nextCompleted = !current?.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextCompleted } : t)));

    try {
      await api.tasks.update(id, { completed: nextCompleted });
    } catch (e: unknown) {
      // revert the optimistic update on failure
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !nextCompleted } : t)));
      // If it was a 401, api.ts already cleared the token and the global
      // AuthEventHandler is already redirecting to Login — nothing else to do.
      void e;
    }
  };

  const pendingCount = tasks.filter((t) => !t.done).length;

  return (

<div className="relative min-h-screen bg-[#0A0A0F] px-4 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">

      {/* Ambient orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-100px] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.16) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative mx-auto max-w-sm space-y-5">

        {/* ── 0. Top bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <NotificationBell />
        </div>

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-xs font-semibold text-red-200">Couldn’t load your tasks</p>
            <p className="mt-0.5 text-xs text-red-200/80">{error}</p>
          </div>
        )}

        {/* ── 1. Welcome card ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-5 py-5 shadow-xl overflow-hidden relative">
          {/* Inner accent line */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(108,99,255,0.5), transparent)" }}
          />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#4B5563] font-medium mb-1">{getGreeting()} 👋</p>
              <h1
                className="text-xl font-bold text-white leading-tight"
                style={{ letterSpacing: "-0.03em" }}
              >
                {(profile?.name ?? USER_FALLBACK.name).split(" ")[0]},
              </h1>
              <p className="text-sm text-[#64748B] mt-0.5">Ready to crush today?</p>
            </div>

            {/* Avatar + streak */}
            <Link
              to="/profile"
              className="flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111118] focus-visible:ring-[#6C63FF] rounded-full"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] flex items-center justify-center ring-2 ring-[#6C63FF]/30 ring-offset-2 ring-offset-[#111118]">
                <span className="text-base font-bold text-white">{getInitials(profile?.name ?? USER_FALLBACK.name)}</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-400">
                <HiOutlineFire className="w-3 h-3" /> {USER_FALLBACK.streak}d
              </span>
            </Link>
          </div>

          {/* Mini stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { value: loading ? "–" : tasks.filter((t) => t.done).length, label: "Tasks done" },
              { value: notesCount === null ? "–" : notesCount,             label: "Notes" },
              { value: stats.aiChats,                       label: "AI chats" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-xl bg-white/[0.04] border border-white/[0.05] py-2 text-center"
              >
                <p className="text-base font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
                  {value}
                </p>
                <p className="text-[10px] text-[#4B5563] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. Student card ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-5 py-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineBookOpen className="w-4 h-4 text-[#6C63FF]" />
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">Student</p>
          </div>
          <div className="space-y-2">
            {[
              { Icon: HiOutlineLightningBolt, label: "Name",   value: profile?.name ?? USER_FALLBACK.name },
              { Icon: HiOutlineAcademicCap,   label: "Branch", value: profile?.branch ?? USER_FALLBACK.branch },
              { Icon: HiOutlineCalendar,      label: "Year",   value: profile?.year ?? USER_FALLBACK.year },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                <Icon className="w-4 h-4 text-[#6C63FF] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-[#E2E8F0] font-medium truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Quick actions ────────────────────────────────────────────── */}
        <div>
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard
              icon={HiOutlineDocumentText}
              label="Notes"
              sub={`${notesCount ?? 0} notes saved`}
              accent="#6C63FF"
              glow="radial-gradient(ellipse at top left, rgba(108,99,255,0.12), transparent 70%)"
              onClick={() => navigate("/notes")}
            />
            <QuickActionCard
              icon={HiOutlineClipboardList}
              label="Assignments"
              sub={`${pendingCount} pending`}
              accent="#F59E0B"
              glow="radial-gradient(ellipse at top left, rgba(245,158,11,0.10), transparent 70%)"
              onClick={() => navigate("/tasks")}
            />
            <div className="col-span-2">
              <QuickActionCard
                icon={HiSparkles}
                label="AI Assistant"
                sub="Ask anything — summaries, explanations, quizzes"
                accent="#A78BFA"
                glow="radial-gradient(ellipse at top left, rgba(167,139,250,0.12), transparent 70%)"
                onClick={() => navigate("/ai")}
              />
            </div>
          </div>
        </div>

        {/* ── 4. Recent notifications ─────────────────────────────────────── */}
        <div>
          <SectionHeader title="Recent Notifications" action="See all" onAction={() => navigate("/notifications")} />
          {notificationsLoading ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-4 py-6 text-center shadow-xl">
              <p className="text-xs text-[#64748B]">No notifications yet</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ${
                      !n.read ? "bg-[#6C63FF]/12" : "bg-white/[0.04]"
                    }`}
                  >
                    <HiOutlineBell className={`w-4 h-4 ${!n.read ? "text-[#6C63FF]" : "text-[#64748B]"}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#C4CDD8] leading-snug">{n.title}</p>
                    <p className="text-xs text-[#3B4558] mt-0.5">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 5. Recent activity ──────────────────────────────────────────── */}
        <div>
          <SectionHeader title="Recent Activity" action="See all" onAction={() => navigate("/activity")} />
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
            {ACTIVITIES.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ${a.iconBg}`}>
                  <a.icon className={`w-4 h-4 ${a.iconColor}`} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#C4CDD8] leading-snug">{a.text}</p>
                  <p className="text-xs text-[#3B4558] mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 6. Upcoming tasks ───────────────────────────────────────────── */}
        <div>
          <SectionHeader title="Upcoming Tasks" action="Add task" onAction={() => navigate("/tasks")} />
          {loading ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-4 py-6 text-center shadow-xl">
              <p className="text-xs text-[#64748B]">No tasks yet — add one to get started.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-4 shadow-xl">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </div>
              {pendingCount === 0 && (
                <p className="mt-3 text-center text-xs text-green-400 font-medium">
                  🎉 All tasks done!
                </p>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
