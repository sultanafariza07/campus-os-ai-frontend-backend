import { useEffect, useState } from "react";
import { HiCheckCircle, HiXCircle, HiMinusCircle, HiOutlineArrowLeft } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { api, type AttendanceRecord, type ApiError } from "../lib/api";
import { useApi } from "../lib/api";

type Status = "present" | "absent" | "unmarked";

const STATUS_STYLES: Record<Status, { icon: React.ElementType; bg: string; text: string }> = {
  present: { icon: HiCheckCircle, bg: "bg-green-500/10", text: "text-green-400" },
  absent: { icon: HiXCircle, bg: "bg-red-500/10", text: "text-red-400" },
  unmarked: { icon: HiMinusCircle, bg: "bg-gray-500/10", text: "text-gray-400" },
};

export default function AttendancePage() {
  const navigate = useNavigate();
  const api = useApi();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<"present" | "absent" | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.attendance.list(90); // Fetch last 90 days
      setAttendance(res.attendance);
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError.message ?? "Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkToday = async (status: "present" | "absent") => {
    setMarking(status);
    try {
      await api.attendance.markToday(status);
      await fetchData(); // Refresh data after marking
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError.message ?? `Failed to mark as ${status}.`);
    } finally {
      setMarking(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const todayRecord = attendance.find((r) => r.date === today);

  const stats = {
    present: attendance.filter((r) => r.status === "present").length,
    absent: attendance.filter((r) => r.status === "absent").length,
  };

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-sm px-4 pt-10 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Attendance</h1>
            <p className="mt-1 text-xs text-[#64748B]">Your 90-day record</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] hover:bg-white/10"
          >
            <HiOutlineArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
          <p className="text-sm font-semibold text-white">Mark Today's Attendance</p>
          <p className="mt-1 text-xs text-[#64748B]">
            {todayRecord ? `You are marked ${todayRecord.status} for today.` : "You haven't marked your attendance yet."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleMarkToday("present")}
              disabled={!!marking || todayRecord?.status === "present"}
              className="rounded-xl bg-green-500/10 py-2.5 text-sm font-semibold text-green-300 disabled:opacity-50"
            >
              {marking === "present" ? "Marking..." : "Present"}
            </button>
            <button
              onClick={() => handleMarkToday("absent")}
              disabled={!!marking || todayRecord?.status === "absent"}
              className="rounded-xl bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-50"
            >
              {marking === "absent" ? "Marking..." : "Absent"}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-center text-xs text-red-400">{error}</p>}

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
            <p className="text-xs text-[#64748B]">Present</p>
            <p className="text-2xl font-bold text-white">{stats.present}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
            <p className="text-xs text-[#64748B]">Absent</p>
            <p className="text-2xl font-bold text-white">{stats.absent}</p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-white">History</h2>
          {loading && <p className="mt-4 text-center text-xs text-[#64748B]">Loading history...</p>}
          {!loading && attendance.length === 0 && (
            <p className="mt-4 text-center text-xs text-[#64748B]">No attendance records found.</p>
          )}
          <ul className="mt-3 space-y-2">
            {attendance.map((record) => {
              const { icon: Icon, bg, text } = STATUS_STYLES[record.status];
              return (
                <li key={record.id} className={`flex items-center justify-between rounded-xl p-3 ${bg}`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${text}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{new Date(record.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs text-[#94A3B8]">{record.subject}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold capitalize ${text}`}>{record.status}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}