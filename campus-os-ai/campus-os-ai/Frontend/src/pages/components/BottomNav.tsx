import { useNavigate, useLocation } from "react-router-dom";
import {
  HiOutlineHome,
  HiHome,
  HiOutlineDocumentText,
  HiDocumentText,
  HiOutlineUser,
  HiUser,
  HiOutlineClipboardList,
  HiClipboardList,
  HiSparkles,
} from "react-icons/hi";
import React from "react";

// ─── Tab definition ───────────────────────────────────────────────────────────

type TabId = "home" | "notes" | "tasks" | "ai" | "profile";

interface Tab {
  id: TabId;
  label: string;
  path: string;
  Icon: React.ElementType;
  ActiveIcon: React.ElementType;
}

const TABS: Tab[] = [
  { id: "home",    label: "Home",    path: "/dashboard", Icon: HiOutlineHome,          ActiveIcon: HiHome          },
  { id: "notes",   label: "Notes",   path: "/notes",     Icon: HiOutlineDocumentText,  ActiveIcon: HiDocumentText  },
  { id: "tasks",   label: "Tasks",   path: "/tasks",     Icon: HiOutlineClipboardList, ActiveIcon: HiClipboardList },
  { id: "ai",      label: "AI",      path: "/ai",        Icon: HiSparkles,             ActiveIcon: HiSparkles      },
  { id: "profile", label: "Profile", path: "/profile",   Icon: HiOutlineUser,          ActiveIcon: HiUser          },
];

// ─── Component ────────────────────────────────────────────────────────────────

const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Derive the active tab from the current path. Prefix-matched (rather than
  // an exact-match list) so any future sub-route under a section — e.g.
  // /notes/new, /notes/:id — still highlights the right tab. /dashboard and
  // /activity (a Dashboard sub-view with no tab of its own) fall back to Home.
  const getActiveId = (currentPath: string): TabId => {
    if (currentPath.startsWith("/notes")) return "notes";
    if (currentPath.startsWith("/tasks")) return "tasks";
    if (currentPath.startsWith("/ai")) return "ai";
    if (currentPath.startsWith("/profile")) return "profile";
    return "home";
  };

  const activeId = getActiveId(pathname);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-gray-200">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto font-medium">
        {TABS.map((item) => {
          const isActive = activeId === item.id;
          const IconComponent = isActive ? item.ActiveIcon : item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.path)}
              className={`inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 ${
                isActive ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <IconComponent className="w-6 h-6 mb-1" />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
