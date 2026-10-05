import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

const PAGE = 12;

// Start of the 12-year page that holds `year`, aligned so the newest page
// ends exactly on `max` (the current season sits in the bottom-right corner).
function pageStart(year: number, max: number): number {
  return max - PAGE + 1 - Math.floor((max - year) / PAGE) * PAGE;
}

/**
 * Season selector: ‹ / › steppers around a button that opens a 12-year grid
 * with paging. Replaces the bare number inputs, which were awkward to scrub
 * and accepted any garbage while typing.
 */
export default function YearPicker({
  value,
  onChange,
  min = 1876,
  max = new Date().getFullYear(),
  allowEmpty = false,
  placeholder = "Year",
  label = "Season",
  className,
}: {
  value: number | string | null | undefined;
  onChange: (year: number | null) => void;
  min?: number;
  max?: number;
  /** Shows a "clear" action and lets the value be null (optional filters). */
  allowEmpty?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const parsed = value === "" || value == null ? null : Number(value);
  const year = parsed != null && Number.isFinite(parsed) ? parsed : null;
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(() => pageStart(year ?? max, max));
  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-center the grid on the selection each time it opens.
  useEffect(() => {
    if (open) setStart(pageStart(year ?? max, max));
  }, [open, year, max]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const pick = (y: number) => {
    onChange(Math.min(max, Math.max(min, y)));
    setOpen(false);
  };
  const years = Array.from({ length: PAGE }, (_, i) => start + i);

  return (
    <div ref={wrapRef} className={cn("relative inline-flex items-center gap-1", className)}>
      <button
        type="button"
        className="btn px-2"
        aria-label={`Previous ${label.toLowerCase()}`}
        disabled={year != null && year <= min}
        onClick={() => pick(year == null ? max : year - 1)}
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        className="btn min-w-[6.5rem] justify-between font-mono text-sm tracking-normal"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${year ?? "none"}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn(year == null && "opacity-50")}>{year ?? placeholder}</span>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <button
        type="button"
        className="btn px-2"
        aria-label={`Next ${label.toLowerCase()}`}
        disabled={year != null && year >= max}
        onClick={() => pick(year == null ? max : year + 1)}
      >
        <ChevronRight size={14} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="year-pop absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-white/10 bg-pitch-900/95 p-3 shadow-xl backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="btn px-2"
              aria-label="Earlier years"
              disabled={start <= min}
              onClick={() => setStart((s) => s - PAGE)}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-display text-xs font-bold uppercase tracking-wider opacity-70">
              {Math.max(start, min)} – {start + PAGE - 1}
            </span>
            <button
              type="button"
              className="btn px-2"
              aria-label="Later years"
              disabled={start + PAGE - 1 >= max}
              onClick={() => setStart((s) => s + PAGE)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {years.map((y) => {
              const disabled = y < min || y > max;
              const selected = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => pick(y)}
                  className={cn(
                    "year-cell rounded-md py-1.5 font-mono text-sm transition-colors",
                    disabled && "invisible",
                    selected
                      ? "bg-volt-500 font-bold text-black"
                      : "hover:bg-white/10",
                    !selected && y === max && "text-volt-500"
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <button
              type="button"
              className="text-xs font-bold uppercase tracking-wider text-volt-500 hover:underline"
              onClick={() => pick(max)}
            >
              Latest ({max})
            </button>
            {allowEmpty && year != null && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs uppercase tracking-wider opacity-60 hover:opacity-100"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
