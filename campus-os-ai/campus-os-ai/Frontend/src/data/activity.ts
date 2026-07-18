import {
  HiSparkles,
  HiOutlineDocumentText,
  HiOutlineClipboardList,
  HiCheckCircle,
} from "react-icons/hi";

export interface Activity {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  text: string;
  time: string;
}

// This is the same mock data DashboardPage's "Recent Activity" card has
// always shown (no activity-log API exists yet — see the CampusOS audit).
// It now lives here so the Dashboard's "See all" link and the full
// ActivityPage render the exact same list instead of two copies of it.
export const ACTIVITIES: Activity[] = [
  { id: 1, icon: HiOutlineDocumentText, iconColor: "text-[#6C63FF]", iconBg: "bg-[#6C63FF]/12", text: "Added notes for Data Structures",     time: "2 min ago"  },
  { id: 2, icon: HiSparkles,            iconColor: "text-amber-400", iconBg: "bg-amber-400/10", text: "AI summarised OS Module 4",            time: "1 hr ago"   },
  { id: 3, icon: HiCheckCircle,         iconColor: "text-green-400", iconBg: "bg-green-400/10", text: "Marked CN Notes as complete",          time: "3 hrs ago"  },
  { id: 4, icon: HiOutlineClipboardList,iconColor: "text-sky-400",   iconBg: "bg-sky-400/10",   text: "Created assignment: DBMS Lab Report",  time: "Yesterday"  },
];
