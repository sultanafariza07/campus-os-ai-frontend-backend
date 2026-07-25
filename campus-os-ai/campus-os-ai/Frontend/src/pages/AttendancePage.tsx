import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import {
  HiOutlineArrowLeft,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCalendar,
  HiCalendar,
  HiCheckCircle,
  HiExclamationCircle,
  HiMinusCircle,
} from "react-icons/hi";
import { SkeletonRow } from "./components/Skeleton";
import { Toast, type ToastKind } from "./components/Toast";

type Status = "Present" | "Absent" | "Late";

interface AttendanceRecord {
  id: number;
  date: string;
  subject: string;
  status: Status;
  createdAt: string;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function AttendanceModal({
  record,
  onSave,
  onCancel,
  loading,
  error,
}: {
  record: Partial<AttendanceRecord> | null;
  onSave: (data: {
    date: string;
    subject: string;
    status: Status;
  }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  // Helper to format date as 'yyyy-MM-dd' for the input
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const [date, setDate] = useState(() => {
    // When editing, the date from the record might be a full ISO string.
    // new Date() can be off-by-one depending on timezone.
    return record?.date ? record.date.split('T')[0] : formatDateForInput(new Date());
  });
  const [subject, setSubject] = useState(record?.subject ?? "");
  const [status, setStatus] = useState<Status>(record?.status ?? "Present");

  const handleSave = () => {
    if (date && subject) {
      onSave({ date, subject, status });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8 sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#16161F] p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-1">
          {record?.id ? "Edit" : "Add"} Attendance
        </h3>
        <p className="text-sm text-[#64748B] mb-6">
          {record?.id
            ? "Update the details for this attendance record."
            : "Log a new attendance record."}
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[#64748B]">Date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#64748B]">Subject</span>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#64748B]">Status</span>
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
            </select>
          </label>
          {error && <div className="text-xs text-red-400">{error}</div>}
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
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#6C63FF]/90 py-2.5 text-sm font-semibold text-white hover:bg-[#6C63FF] transition-colors disabled:opacity-60"
            disabled={loading || !date || !subject}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRecord, setModalRecord] =
    useState<Partial<AttendanceRecord> | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);

  const STATUS_STYLES: Record<
    Status,
    { icon: React.ElementType; bg: string; text: string }
  > = {
    Present: {
      icon: HiCheckCircle,
      bg: "bg-green-500/10",
      text: "text-green-400",
    },
    Absent: {
      icon: HiExclamationCircle,
      bg: "bg-red-500/10",
      text: "text-red-400",
    },
    Late: { icon: HiMinusCircle, bg: "bg-yellow-500/10", text: "text-yellow-400" },
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.attendance.list();
      // Sort records by date, most recent first.
      const sorted = res.attendance.sort((a: AttendanceRecord, b: AttendanceRecord) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

  const handleSave = async (data: {
    date: string;
    subject:string;
    status: Status;
  }) => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (modalRecord?.id) {
        await api.attendance.update(modalRecord.id, data);
        setToast({ kind: "success", text: "Record updated" });
      } else {
        await api.attendance.create(data);
        setToast({ kind: "success", text: "Record added" });
      }
      setModalRecord(null);
      await fetchData();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Failed to save record.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    // Optimistic deletion for better UX
    const originalAttendance = attendance;
    setAttendance(attendance.filter((r) => r.id !== id));
    try {
      await api.attendance.delete(id);
      setToast({ kind: "success", text: "Record deleted" });
    } catch (e) {
      setAttendance(originalAttendance);
      if (!(e instanceof ApiRequestError && e.status === 401)) {
        setToast({ kind: "error", text: "Failed to delete record" });
      }
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

        <button
          type="button"
          onClick={() => setModalRecord({})}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C63FF]/20 transition-all hover:bg-[#7C6FFF] active:scale-[0.98]"
        >
          <HiOutlinePlus className="w-4 h-4" /> Add Record
        </button>

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
              const statusKey = record.status;
              const { icon: Icon, bg, text } = STATUS_STYLES[statusKey];
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-4"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`w-5 h-5 ${text}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {record.subject}
                    </p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {new Date(record.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setModalRecord(record)} className="text-[#64748B] hover:text-white">
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(record.id)} className="text-[#64748B] hover:text-red-400">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalRecord && (
        <AttendanceModal
          record={modalRecord}
          onSave={handleSave}
          onCancel={() => setModalRecord(null)}
          loading={modalLoading}
          error={modalError}
        />
      )}
    </div>
  );
}