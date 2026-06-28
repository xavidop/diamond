import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationsContext";
import { buildMessage } from "../../lib/notifyEmit";
import { cn } from "../../lib/utils";
import NotificationSettings from "./NotificationSettings";

/**
 * `placement` controls which way the panel opens so it never lands off-screen:
 * - "bottom" (default): opens downward, right-aligned — for top bars.
 * - "top": opens upward, left-aligned — for the sidebar footer at the bottom
 *   of the viewport, where a downward panel would be clipped below the fold.
 */
export default function NotificationsBell({
  placement = "bottom",
}: {
  placement?: "top" | "bottom";
}) {
  const { feed, unreadCount, markFeedRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) markFeedRead();
      return next;
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className={cn("btn relative p-1.5", open && "btn-accent")}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-volt-500 px-1 text-[10px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/10 bg-pitch-900 shadow-xl diamond-chrome",
            // The footer bell is the right-most icon in a left-anchored sidebar.
            // On mobile (narrow drawer) anchor the panel to the bell's right so a
            // 300px panel can't shoot off the right edge; on lg+ the sidebar sits
            // at the screen's left, so open right into the content area instead.
            placement === "top"
              ? "bottom-full right-0 mb-2 w-[260px] lg:left-0 lg:right-auto lg:w-[300px]"
              : "top-full right-0 mt-2 w-[300px]"
          )}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-pitch-400">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[11px] text-volt-400">{unreadCount} new</span>
            )}
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {feed.length === 0 ? (
              <div className="px-3 pb-3 text-sm text-pitch-400">No notifications yet.</div>
            ) : (
              feed.map((f) => {
                const { title, body } = buildMessage(f);
                return (
                  <Link
                    key={f.id}
                    to={`/game/${f.gamePk}`}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-white/5"
                  >
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="truncate text-xs text-pitch-300">{body}</div>
                  </Link>
                );
              })
            )}
          </div>
          <NotificationSettings />
        </div>
      )}
    </div>
  );
}
