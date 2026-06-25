import { useNotifications } from "../../contexts/NotificationsContext";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-pitch-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-volt-500"
      />
    </label>
  );
}

export default function NotificationSettings() {
  const { settings, updateSettings, requestPermission } = useNotifications();

  return (
    <div className="space-y-1 border-t border-white/10 px-3 py-2">
      <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-pitch-400">
        Settings
      </div>
      <Toggle
        label="Enable notifications"
        checked={settings.enabled}
        onChange={(v) => updateSettings({ enabled: v })}
      />
      <Toggle
        label="Auto-follow favorite teams"
        checked={settings.followFavorites}
        onChange={(v) => updateSettings({ followFavorites: v })}
      />
      <Toggle
        label="Run scored"
        checked={settings.runScored}
        onChange={(v) => updateSettings({ runScored: v })}
      />
      <Toggle
        label="Game final"
        checked={settings.gameFinal}
        onChange={(v) => updateSettings({ gameFinal: v })}
      />
      <Toggle
        label="Game starting"
        checked={settings.gameStarting}
        onChange={(v) => updateSettings({ gameStarting: v })}
      />
      {settings.permission === "default" && (
        <button
          type="button"
          onClick={() => void requestPermission()}
          className="mt-1 w-full rounded-md bg-volt-500 px-2 py-1.5 text-xs font-semibold text-black hover:bg-volt-400"
        >
          Enable browser notifications
        </button>
      )}
      {settings.permission === "denied" && (
        <p className="pt-1 text-[11px] text-pitch-400">
          Browser notifications are blocked. In-app toasts still work; re-enable in your
          browser settings.
        </p>
      )}
    </div>
  );
}
