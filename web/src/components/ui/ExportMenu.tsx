import { Download } from "lucide-react";
import { useState } from "react";
import { exportCsv, exportJson, type Column } from "../../lib/exporters";

export default function ExportMenu<T>({
  filename,
  rows,
  cols,
}: {
  filename: string;
  rows: T[];
  cols: Column<T>[];
}) {
  const [open, setOpen] = useState(false);
  if (!rows?.length) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn inline-flex items-center gap-1"
        title="Export data"
      >
        <Download size={14} />
        Export
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1 z-30 min-w-[140px] rounded-md border border-white/10 bg-pitch-900/95 backdrop-blur shadow-lg">
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/5"
              onClick={() => {
                exportCsv(`${filename}.csv`, rows, cols);
                setOpen(false);
              }}
            >
              Download CSV
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/5"
              onClick={() => {
                exportJson(`${filename}.json`, rows);
                setOpen(false);
              }}
            >
              Download JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
