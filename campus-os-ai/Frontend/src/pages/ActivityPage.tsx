import { useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft } from "react-icons/hi";
import { ACTIVITIES } from "../data/activity";

// Full activity list.
//
// There's no activity-log API yet, so this reuses the same mock data the
// Dashboard's "Recent Activity" card shows (see data/activity.ts) and
// renders it with the exact same list-item styling — just as a standalone
// page instead of a 4-item preview. This gives the "See all" link a real
// destination instead of doing nothing.
export default function ActivityPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] px-4 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      {/* Ambient orb — same treatment as Dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-100px] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.16) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative mx-auto max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
              Recent Activity
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">Everything that's happened lately.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
          >
            <HiOutlineArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {ACTIVITIES.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-6 text-center shadow-xl">
            <p className="text-sm font-semibold text-white">No activity yet</p>
            <p className="mt-2 text-xs text-[#64748B]">Things you do around CampusOS will show up here.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-4 py-2 shadow-xl">
            {ACTIVITIES.map((a, i) => (
              <div key={a.id} className="relative flex items-start gap-3 py-3">
                {/* Timeline connector — a vertical line running behind each icon, linking it to the next */}
                {i < ACTIVITIES.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[19px] top-9 bottom-[-12px] w-px bg-white/[0.08]"
                  />
                )}
                <span className={`relative z-10 mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ring-4 ring-[#111118] ${a.iconBg}`}>
                  <a.icon className={`w-4 h-4 ${a.iconColor}`} />
                </span>
                <div className="flex-1 min-w-0 pb-0.5">
                  <p className="text-sm text-[#C4CDD8] leading-snug">{a.text}</p>
                  <p className="text-xs text-[#3B4558] mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[#4B5563]">
          That's everything for now — a full activity history is coming in a future update.
        </p>
      </div>
    </div>
  );
}
