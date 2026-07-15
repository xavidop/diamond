import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmtDate(d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(date);
}

export function fmtTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type SpilloverGame = {
  gamePk: number;
  status?: { abstractGameState?: string };
  gameDate?: string;
};

// A single MLB slate's games all start within ~12h; this bounds how far back a
// finished adjacent-day game can have started and still count as "today".
const SPILLOVER_WINDOW_MS = 12 * 60 * 60 * 1000;

// mergeRecentSpillover returns primary plus any adjacent-day game that belongs
// to the same rolling window and isn't already present: still Live, or started
// within the last 12h. The MLB schedule files a game under the US date it's
// played, so for a viewer east of the US (e.g. Spain) a game that started
// before their local midnight lands under the previous local date. Keying off
// the game's absolute start time (gameDate, UTC) instead of the local calendar
// date keeps those games — live OR just-finished — on "today" regardless of
// timezone, rather than vanishing at local midnight for the next slate.
export function mergeRecentSpillover<T extends SpilloverGame>(
  primary: T[],
  adjacent: T[],
  now: Date = new Date(),
): T[] {
  const seen = new Set(primary.map((g) => g.gamePk));
  const out = [...primary];
  const nowMs = now.getTime();
  const cutoff = nowMs - SPILLOVER_WINDOW_MS;
  for (const g of adjacent) {
    if (seen.has(g.gamePk)) continue;
    let keep = g.status?.abstractGameState === "Live";
    if (!keep && g.gameDate) {
      const start = new Date(g.gameDate).getTime();
      keep = !Number.isNaN(start) && start >= cutoff && start <= nowMs;
    }
    if (keep) {
      out.push(g);
      seen.add(g.gamePk);
    }
  }
  return out;
}
