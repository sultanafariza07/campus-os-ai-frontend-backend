import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineBell } from "react-icons/hi";
import { api, ApiRequestError, type NotificationItem } from "../../lib/api";
import { NOTIFICATION_TYPE_ICON, NOTIFICATION_TYPE_STYLE } from "../../lib/notificationStyles";
import { SkeletonRow } from "./Skeleton";

// How often we poll for the unread count. There's no websocket/SSE
// infrastructure in this project's backend, so "real-time" here means
// "checks in the background every 30s" rather than a live push — see the
// Phase 13 changelog for the tradeoff and what a true real-time upgrade
// would need.
const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const res = await api.notifications.unreadCount();
      setCount(res.count);
    } catch {
      // A failed background poll shouldn't disrupt the page. 401s are
      // already handled globally by AuthEventHandler.
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = window.setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoadingItems(true);
      try {
        const res = await api.notifications.list({ limit: 6 });
        setItems(res.notifications);
      } catch (e: unknown) {
        if (!(e instanceof ApiRequestError && e.status === 401)) {
          setItems([]);
        }
      } finally {
        setLoadingItems(false);
      }
    }
  };

  const markRead = async (id: number) => {
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? prev);
    setCount((c) => Math.max(0, c - 1));
    try {
      await api.notifications.markRead(id);
    } catch {
      // Best-effort — the next poll reconciles the real count either way.
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    setCount(0);
    try {
      await api.notifications.markAllRead();
    } catch {
      // Best-effort — the next poll reconciles the real count either way.
    }
  };

  const hasUnread = (items ?? []).some((n) => !n.read);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-[#111118] text-[#94A3B8] transition-colors hover:text-white hover:border-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
      >
        <HiOutlineBell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F43F5E] px-1 text-[10px] font-bold text-white ring-2 ring-[#0A0A0F]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 max-w-[85vw] rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {hasUnread && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-[#6C63FF] hover:text-[#A5A0FF] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.05]">
            {loadingItems && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!loadingItems && items && items.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-[#64748B]">You're all caught up 🎉</p>
              </div>
            )}

            {!loadingItems &&
              items?.map((n) => {
                const Icon = NOTIFICATION_TYPE_ICON[n.type] ?? HiOutlineBell;
                const style = NOTIFICATION_TYPE_STYLE[n.type] ?? NOTIFICATION_TYPE_STYLE.general;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.read && markRead(n.id)}
                    className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                      !n.read ? "bg-[#6C63FF]/[0.04]" : ""
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg ${style.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${style.color}`} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="block text-xs font-medium text-[#E2E8F0] truncate">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6C63FF]" aria-hidden="true" />}
                      </span>
                      {n.message && (
                        <span className="block text-xs text-[#64748B] mt-0.5 line-clamp-2">{n.message}</span>
                      )}
                    </span>
                  </button>
                );
              })}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            className="block w-full px-4 py-3 text-center text-xs font-semibold text-[#6C63FF] hover:bg-white/[0.03] transition-colors border-t border-white/[0.06]"
          >
            View all
          </button>
        </div>
      )}
    </div>
  );
}
