export type Column<T> = {
  key: string;
  label?: string;
  get?: (row: T) => unknown;
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T>(rows: T[], cols: Column<T>[]): string {
  const header = cols.map((c) => csvEscape(c.label ?? c.key)).join(",");
  const lines = rows.map((r) =>
    cols
      .map((c) => csvEscape(c.get ? c.get(r) : (r as any)[c.key]))
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function toJson<T>(rows: T[]): string {
  return JSON.stringify(rows, null, 2);
}

export function download(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportCsv<T>(filename: string, rows: T[], cols: Column<T>[]) {
  download(filename, toCsv(rows, cols), "text/csv;charset=utf-8");
}

export function exportJson<T>(filename: string, rows: T[]) {
  download(filename, toJson(rows), "application/json");
}
