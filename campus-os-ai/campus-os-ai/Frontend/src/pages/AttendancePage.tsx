import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError, type AttendanceRecord } from "../lib/api";
import {
  HiOutlineArrowLeft,
  HiOutlineCalendar,
  HiCalendar,
  HiCheckCircle,
  HiExclamationCircle,
} from "react-icons/hi";
import { SkeletonRow } from "./components/Skeleton";
import { Toast, type ToastKind } from "./components/Toast";

export default function AttendancePage() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.attendance.list();
      // Sort records by date, most recent first.
      const sorted = res.attendance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttendance(sorted);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        // This is handled by the global AuthEventHandler, which will redirect to the login page.
        // No need to navigate here, as it can cause redirect loops.
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleMarkToday = async (present: boolean) => {
    setMarkingLoading(true);
    try {
      await api.attendance.markToday(present);
      setToast({ kind: "success", text: `Marked as ${present ? 'Present' : 'Absent'}` });
      await fetchData();
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.status === 401)) {
        setToast({ kind: "error", text: "Failed to mark attendance" });
      }
    } finally {
      setMarkingLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] px-4 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-100px] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.16) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {toast && <Toast kind={toast.kind} text={toast.text} />}

      <div className="relative mx-auto max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold text-white"
              style={{ letterSpacing: "-0.03em" }}
            >
              Attendance
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Track your class attendance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
          >
            <HiOutlineArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleMarkToday(true)}
            disabled={markingLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition-all hover:bg-green-500 active:scale-[0.98] disabled:opacity-60"
          >
            <HiCheckCircle className="w-4 h-4" /> Mark Present
          </button>
          <button
            type="button"
            onClick={() => handleMarkToday(false)}
            disabled={markingLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-500 active:scale-[0.98] disabled:opacity-60"
          >
            <HiExclamationCircle className="w-4 h-4" /> Mark Absent
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl overflow-hidden">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center shadow-xl">
            <p className="text-sm font-semibold text-red-300">
              Error loading attendance
            </p>
            <p className="mt-2 text-xs text-red-300/70">{error}</p>
          </div>
        ) : attendance.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-6 text-center shadow-xl">
            <HiCalendar className="w-10 h-10 mx-auto text-[#3B4558] mb-3" />
            <p className="text-sm font-semibold text-white">No records yet</p>
            <p className="mt-2 text-xs text-[#64748B]">
              Add your first attendance record to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] divide-y divide-white/[0.05] shadow-xl">
            {attendance.map((record) => {
              const Icon = record.present ? HiCheckCircle : HiExclamationCircle;
              const bg = record.present ? "bg-green-500/10" : "bg-red-500/10";
              const text = record.present ? "text-green-400" : "text-red-400";
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-4"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-5 w-5 ${text}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {new Date(record.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                    </p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {record.present ? 'Present' : 'Absent'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}