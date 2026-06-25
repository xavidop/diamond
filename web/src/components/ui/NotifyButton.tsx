import { Bell, BellOff } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationsContext";
import { cn } from "../../lib/utils";

export default function NotifyButton({
  gamePk,
  label,
  size = 14,
  className,
}: {
  gamePk: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const { isSubscribed, toggleSubscription, requestPermission, settings } = useNotifications();
  const active = isSubscribed(gamePk);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!active && settings.permission === "default") {
          void requestPermission();
        }
        toggleSubscription({ gamePk, label });
      }}
      title={active ? "Stop notifications for this game" : "Notify me about this game"}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
        active ? "text-volt-400 hover:text-volt-300" : "text-pitch-300/60 hover:text-volt-400",
        className
      )}
    >
      {active ? (
        <Bell size={size} fill="currentColor" strokeWidth={2} />
      ) : (
        <BellOff size={size} strokeWidth={2} />
      )}
    </button>
  );
}
