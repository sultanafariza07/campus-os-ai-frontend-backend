import { HiOutlineBell, HiSparkles, HiOutlineDocumentText, HiOutlineClipboardList } from "react-icons/hi";
import type { NotificationType } from "./api";

export const NOTIFICATION_TYPE_ICON: Record<NotificationType, React.ElementType> = {
  task: HiOutlineClipboardList,
  note: HiOutlineDocumentText,
  ai: HiSparkles,
  general: HiOutlineBell,
};

export const NOTIFICATION_TYPE_STYLE: Record<NotificationType, { bg: string; color: string }> = {
  task: { bg: "bg-[#F59E0B]/12", color: "text-[#F59E0B]" },
  note: { bg: "bg-[#6C63FF]/12", color: "text-[#6C63FF]" },
  ai: { bg: "bg-[#A78BFA]/12", color: "text-[#A78BFA]" },
  general: { bg: "bg-sky-400/10", color: "text-sky-400" },
};
