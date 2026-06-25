import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationsContext";
import { buildMessage } from "../../lib/notifyEmit";
import NotificationSettings from "./NotificationSettings";

export default function NotificationsBell() {
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
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-pitch-200 hover:bg-white/5 hover:text-white"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-volt-500 px-1 text-[10px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-xl border border-white/10 bg-pitch-900 shadow-xl diamond-chrome">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-pitch-400">
            Recent
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
