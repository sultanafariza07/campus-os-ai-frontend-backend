import { useEffect, useState } from "react";
import { api, clearToken, ApiRequestError, type UserProfileDto } from "../lib/api";
import { useNavigate } from "react-router-dom";

import {
  HiOutlineMail,
  HiOutlineAcademicCap,
  HiOutlineCalendar,
  HiOutlinePencil,
  HiOutlineLogout,
  HiOutlineShieldCheck,
  HiOutlineBell,
  HiOutlineChevronRight,
  HiSparkles,
  HiOutlineRefresh,
  HiCheckCircle,
  HiOutlineFingerPrint,
} from "react-icons/hi";


// ─── Types ────────────────────────────────────────────────────────────────────

// The profile page's local view of the signed-in user is just the backend's
// profile DTO (see lib/api.ts) — kept as a type alias rather than a
// hand-copied interface so the two can never drift out of sync again.
type UserProfile = UserProfileDto;

interface EffectiveUser {
  name: string;
  email: string;
  branch: string;
  year: string;
  avatar: string | null;
  joinedYear: string;
  tasksCompleted: number;
  notesCreated: number;
  aiChats: number;
}

// ─── Safe defaults ────────────────────────────────────────────────────────────
// Used until the real profile loads, and as fallbacks for fields the
// backend does not yet return (branch, year, stats, etc).

const DEFAULT_USER: EffectiveUser = {
  name: "Student",
  email: "",
  branch: "Not set",
  year: "Not set",
  avatar: null,
  joinedYear: new Date().getFullYear().toString(),
  tasksCompleted: 0,
  notesCreated: 0,
  aiChats: 0,
};
// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/** True if an error message looks like an auth failure (expired/invalid/missing token). */
function isAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("token") ||
    m.includes("authorization") ||
    m.includes("unauthorized") ||
    m.includes("401")
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
        {value}
      </span>
      <span className="text-[10px] text-[#4B5563] font-medium uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  // Added focus-visible styles for accessibility
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] rounded-xl"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon className="w-4 h-4 text-[#94A3B8]" />
      </span>
      <span className="flex-1 text-sm text-[#C4CDD8]">{label}</span>
      <HiOutlineChevronRight className="w-4 h-4 text-[#3B4558]" />
    </button>
  );
}

// ─── Logout modal ─────────────────────────────────────────────────────────────

function LogoutModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8 sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#16161F] p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-1">Log out?</h3>
        <p className="text-sm text-[#64748B] mb-6">
          You'll need to sign in again to access your CampusOS account.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#94A3B8] hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile Modal ──────────────────────────────────────────────────────

function EditProfileModal({
  initialData,
  onSave,
  onCancel,
  loading,
  error,
}: {
  initialData: { name: string; branch: string; year: string; avatar: string | null };
  onSave: (updatedData: {
    name: string;
    branch: string;
    year: string;
    avatar: string | null;
  }) => Promise<void> | void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initialData.name);
  const [branch, setBranch] = useState(initialData.branch);
  const [year, setYear] = useState(initialData.year);
  const [avatar, setAvatar] = useState<string | null>(initialData.avatar);

  useEffect(() => {
    setName(initialData.name);
    setBranch(initialData.branch);
    setYear(initialData.year);
    setAvatar(initialData.avatar);
  }, [initialData]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8 sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#16161F] p-6 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-white mb-1">Edit Profile</h3>
        <p className="text-sm text-[#64748B] mb-6">
          Update your details. (Backend support may be limited.)
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[#64748B]">Name</span>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#64748B]">Branch</span>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#64748B]">Year</span>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </label>

          {error ? <div className="text-xs text-red-400">{error}</div> : null}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#94A3B8] hover:bg-white/10 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ name, branch, year, avatar })}
            className="flex-1 rounded-xl bg-[#6C63FF]/90 py-2.5 text-sm font-semibold text-white hover:bg-[#6C63FF] transition-colors disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [editToast, setEditToast] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Separate state for stats, which are fetched from different endpoints
  const [tasksCount, setTasksCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);

  // State for edit profile modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  const handleEdit = () => {
    setShowEditModal(true);
    setEditModalError(null); // Clear any previous errors when opening
  };

  const handleSaveProfile = async (updatedData: {
    name: string;
    branch: string;
    year: string;
    avatar: string | null;
  }) => {
    setSaveLoading(true);
    setEditModalError(null); // Clear previous errors
    try {
      // The backend doesn't support avatar updates, so we only send name, branch, and year.
      const res = await api.auth.updateProfile({
        name: updatedData.name,
        branch: updatedData.branch,
        year: updatedData.year,
      });
      setProfile(res.user); // Update profile state with the response from the backend
      setShowEditModal(false);
      setEditToast(true);
      setTimeout(() => setEditToast(false), 2500);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update profile.";
      setEditModalError(message);
      // Re-throw or handle as needed if you want to keep the modal open on error
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogout(false);
    clearToken();
    navigate("/", { replace: true });
  };

  const fetchData = () => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch profile, tasks, and notes in parallel
        const [profileRes, tasksRes, notesRes] = await Promise.all([
          api.auth.profile(),
          api.tasks.list(),
          api.notes.list(),
        ]);

        if (!mounted) return;

        setProfile(profileRes.user);
        // The backend profile DTO does not include stats, so we get them from the list endpoints
        setTasksCount(tasksRes.tasks.filter((t: any) => t.completed).length);
        setNotesCount(notesRes.notes.length);

        // The AI chats stat is not available from any endpoint, so it remains at 0

      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";

        if (e instanceof ApiRequestError && e.status === 401) {
          clearToken();
          navigate("/", { replace: true });
          return;
        }

        // Fallback for backends that may return 401 with a non-standard message.
        if (isAuthError(message)) {
          clearToken();
          navigate("/", { replace: true });
          return;
        }


        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
  };
  useEffect(() => {
    fetchData();
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <p className="text-sm text-[#64748B]">Loading profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <HiOutlineLogout className="w-7 h-7 text-[#64748B]" />
          </div>
          <p className="text-white font-semibold text-lg mb-1">Something went wrong</p>
          <p className="text-sm text-[#4B5563]">
            {isAuthError(error)
              ? "Your session expired. Please sign in again."
              : "Could not load your profile."}
          </p>
          {!isAuthError(error) && (
            <button
              type="button"
              onClick={fetchData}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#6C63FF] px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-[#6C63FF]/20 hover:bg-[#7C6FFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
            >
              <HiOutlineRefresh className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveUser: EffectiveUser = {
    name: profile?.name ?? DEFAULT_USER.name,
    email: profile?.email ?? DEFAULT_USER.email,
    branch: profile?.branch ?? DEFAULT_USER.branch,
    year: profile?.year ?? DEFAULT_USER.year,
    avatar: profile?.avatar ?? DEFAULT_USER.avatar,
    joinedYear: profile?.createdAt ? new Date(profile.createdAt).getFullYear().toString() : DEFAULT_USER.joinedYear,
    tasksCompleted: tasksCount,
    notesCreated: notesCount,
    aiChats: 0, // AI chats stat is not available from backend
  };

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] px-4 py-10 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">


      {/* Ambient orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-80px] left-1/2 -translate-x-1/2 w-[420px] h-[320px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative mx-auto max-w-sm space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
            Campus<span className="text-[#6C63FF]">OS</span>
          </h1>
          <span className="flex items-center gap-1.5 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-3 py-1">
            <HiSparkles className="w-3.5 h-3.5 text-[#6C63FF]" />
            <span className="text-xs font-medium text-[#A5A0FF]">AI Plan</span>
          </span>
        </div>

        {/* ── Profile card ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-6 py-7 shadow-xl text-center">

          {/* Avatar */}
          <div className="relative inline-block mb-4">
            {effectiveUser.avatar ? (
              <img
                src={effectiveUser.avatar}
                alt={effectiveUser.name}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-[#6C63FF]/40 ring-offset-2 ring-offset-[#111118]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] flex items-center justify-center ring-2 ring-[#6C63FF]/40 ring-offset-2 ring-offset-[#111118]">
                <span className="text-xl font-bold text-white">{getInitials(effectiveUser.name)}</span>
              </div>
            )}
            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-[#111118]" />
          </div>

          <h2 className="text-xl font-bold text-white mb-0.5" style={{ letterSpacing: "-0.02em" }}>
            {effectiveUser.name}
          </h2>
          <p className="text-xs text-[#4B5563] mb-5">Joined {effectiveUser.joinedYear}</p>

          <div className="space-y-2 text-left mb-6">
            {[
              { Icon: HiOutlineMail, value: effectiveUser.email },
              { Icon: HiOutlineAcademicCap, value: effectiveUser.branch },
              { Icon: HiOutlineCalendar, value: effectiveUser.year },
            ].map(({ Icon, value }) => (
              <div
                key={String(value) || Math.random()}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5"
              >
                <Icon className="w-4 h-4 text-[#6C63FF] shrink-0" />
                <span className="text-sm text-[#C4CDD8] truncate">{value || "Not set"}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleEdit}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#E2E8F0] hover:bg-white/10 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111118]"
            >
              <HiOutlinePencil className="w-4 h-4" />
              Edit Profile
            </button>
            <button
              type="button"
              onClick={() => setShowLogout(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <HiOutlineLogout className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* ── Stats card ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-6 py-5 shadow-xl">
          <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-widest mb-4">Activity</p>
          <div className="flex items-center justify-around divide-x divide-white/[0.06]">
            <StatPill value={effectiveUser.tasksCompleted} label="Tasks" />
            <StatPill value={effectiveUser.notesCreated} label="Notes" />
            <StatPill value={effectiveUser.aiChats} label="AI Chats" />
          </div>
        </div>

        {/* ── Settings card ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-2 py-2 shadow-xl">
          <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-widest px-4 pt-2 pb-1">Settings</p>
          <SettingsRow icon={HiOutlineBell} label="Notifications" />
          <SettingsRow icon={HiOutlineShieldCheck} label="Privacy & Security" />
          <SettingsRow
            icon={HiOutlineFingerPrint}
            label="Gesture sign-in"
            onClick={() => navigate("/gesture-setup")}
          />
        </div>
      </div>

      {showLogout && <LogoutModal onCancel={() => setShowLogout(false)} onConfirm={handleLogout} />}

      {showEditModal && profile && (
        <EditProfileModal
          initialData={effectiveUser}
          onSave={handleSaveProfile}
          onCancel={() => setShowEditModal(false)}
          loading={saveLoading}
          error={editModalError}
        />
      )}

      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-[#1C1C2A] px-4 py-2 shadow-xl transition-all duration-300 ${
          editToast
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <HiCheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-xs font-medium text-[#E2E8F0]">Profile saved!</span>
      </div>
    </div>
  );
}
