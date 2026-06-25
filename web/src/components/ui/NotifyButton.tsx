import { Bell } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationsContext";
import { cn } from "../../lib/utils";

/**
 * Per-game notification toggle.
 * - "icon" (default): a bare bell for dense card headers — outline when off,
 *   filled volt when subscribed (mirrors FavButton's star idiom).
 * - "button": a labeled .btn that reads "Notify" / "Notifying", taking the
 *   volt .btn-accent treatment when active (mirrors the sidebar toggles).
 */
export default function NotifyButton({
  gamePk,
  label,
  variant = "icon",
  size = 14,
  className,
}: {
  gamePk: number;
  label: string;
  variant?: "icon" | "button";
  size?: number;
  className?: string;
}) {
  const { isSubscribed, toggleSubscription, requestPermission, settings } =
    useNotifications();
  const active = isSubscribed(gamePk);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!active && settings.permission === "default") {
      void requestPermission();
    }
    toggleSubscription({ gamePk, label });
  }

  const title = active
    ? "Stop notifications for this game"
    : "Notify me about this game";

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-pressed={active}
        className={cn("btn px-2.5 py-1", active && "btn-accent", className)}
      >
        <Bell size={size} fill={active ? "currentColor" : "none"} strokeWidth={2} />
        {active ? "Notifying" : "Notify"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
        active ? "text-volt-400 hover:text-volt-300" : "text-pitch-300/50 hover:text-volt-400",
        className
      )}
    >
      <Bell size={size} fill={active ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}
