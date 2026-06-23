import { X } from "lucide-react";
import { SHORTCUT_GROUPS } from "../../hooks/useShortcuts";

export default function ShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-[10vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-pitch-900/95 shadow-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div>
            <div className="text-xs uppercase tracking-wider text-pitch-300/70">
              Keyboard shortcuts
            </div>
            <div className="text-sm text-white/70">
              Press <Kbd>?</Kbd> any time to toggle
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-pitch-300/70 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[10px] uppercase tracking-widest text-pitch-300/60 mb-2">
                {g.title}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {g.items.map(([k, lbl]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-pitch-300">{lbl}</span>
                    <Kbd>{k}</Kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-1 rounded border border-white/10 bg-pitch-950/60 px-1.5 py-0.5 text-[11px] font-sans text-pitch-300">
      {children}
    </kbd>
  );
}
