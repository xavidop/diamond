import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useSport } from "../../contexts/SportContext";
import { cn } from "../../lib/utils";

export default function SportPicker() {
  const { sport, sports, setSportId } = useSport();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn"
        title="Switch sport / league"
      >
        <Globe2 size={14} />
        <span className="hidden sm:inline">{sport.abbreviation}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 bottom-full mb-2 w-72 rounded-xl border border-white/10",
            "bg-pitch-900/95 backdrop-blur-md shadow-card z-50",
            "max-h-[60vh] overflow-y-auto py-1"
          )}
        >
          {sports.map((s) => {
            const active = s.id === sport.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSportId(s.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left text-sm",
                  "hover:bg-white/5",
                  active && "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-12 shrink-0 items-center justify-center",
                    "rounded-md text-[10px] font-bold tracking-wider",
                    active
                      ? "bg-volt-500 text-black"
                      : "bg-pitch-800 text-pitch-300"
                  )}
                >
                  {s.abbreviation}
                </span>
                <span className="flex-1 truncate">{s.name}</span>
                {active && <Check size={14} className="text-pitch-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
