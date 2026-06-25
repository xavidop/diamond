import { Bell, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

export default function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const inner = (
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-pitch-900 px-4 py-3 shadow-lg diamond-chrome">
            <Bell size={16} className="mt-0.5 shrink-0 text-volt-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t.title}</div>
              <div className="truncate text-xs text-pitch-300">{t.body}</div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(t.id);
              }}
              className="shrink-0 text-pitch-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        );
        return t.gamePk != null ? (
          <Link key={t.id} to={`/game/${t.gamePk}`} className="block">
            {inner}
          </Link>
        ) : (
          <div key={t.id}>{inner}</div>
        );
      })}
    </div>
  );
}
