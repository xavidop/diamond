export type Percentile = { key: string; label: string; value: number };
export type SavantResult =
  | { ok: true; season: number; percentiles: Percentile[] }
  | { ok: false };

// Recognized percentile columns → display labels (order defines render order).
const COLUMNS: [string, string][] = [
  ["xwoba", "xwOBA"],
  ["xba", "xBA"],
  ["xslg", "xSLG"],
  ["xiso", "xISO"],
  ["xobp", "xOBP"],
  ["brl_percent", "Barrel%"],
  ["exit_velocity", "Exit Velo"],
  ["max_ev", "Max EV"],
  ["hard_hit_percent", "Hard-Hit%"],
  ["k_percent", "K%"],
  ["bb_percent", "BB%"],
  ["whiff_percent", "Whiff%"],
  ["chase_percent", "Chase%"],
  ["arm_strength", "Arm"],
  ["sprint_speed", "Sprint Speed"],
  ["oaa", "OAA"],
  ["bat_speed", "Bat Speed"],
];

// Split one CSV line into fields, honoring double-quoted fields that may
// contain commas (e.g. "Judge, Aaron") and escaped quotes ("").
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function parseCsv(csv: string): Record<string, string>[] {
  const text = csv.replace(/^﻿/, "").trim();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function rowToPercentiles(row: Record<string, string>): Percentile[] {
  const out: Percentile[] = [];
  for (const [key, label] of COLUMNS) {
    const raw = row[key];
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (Number.isNaN(value)) continue;
    out.push({ key, label, value });
  }
  return out;
}

export function parsePercentileCsv(csv: string, season: number): SavantResult {
  const rows = parseCsv(csv);
  if (rows.length === 0 || !("year" in rows[0])) return { ok: false };

  const wanted = rows.find((r) => Number(r.year) === season && rowToPercentiles(r).length > 0);
  const fallback = [...rows].reverse().find((r) => rowToPercentiles(r).length > 0);
  const row = wanted ?? fallback;
  if (!row) return { ok: false };

  const percentiles = rowToPercentiles(row);
  if (percentiles.length === 0) return { ok: false };
  return { ok: true, season: Number(row.year), percentiles };
}

export async function fetchPercentiles(
  playerId: string,
  type: "batter" | "pitcher",
  season: number
): Promise<SavantResult> {
  const url = `https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&player_id=${encodeURIComponent(
    playerId
  )}&csv=true`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const csv = await res.text();
    return parsePercentileCsv(csv, season);
  } catch {
    return { ok: false };
  }
}
