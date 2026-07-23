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

// League-standard timezone for game start times (MLB schedules in ET).
const ET_ZONE = "America/New_York";

// zoneAbbr returns the short timezone abbreviation (e.g. "EDT", "PDT") for the
// given instant in the given zone, or the viewer's local zone when omitted.
function zoneAbbr(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

// localDayLabel returns the viewer's local weekday (e.g. "Fri") when the local
// calendar day for the instant differs from the game's Eastern (game-day) date,
// so a game after local midnight reads "1:15 AM CEST · Fri". Empty on the same
// day. A weekday keeps a numeric GMT offset ("GMT+2") from colliding with a
// "+1" day marker.
function localDayLabel(date: Date): string {
  const isoDate = (timeZone?: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  if (isoDate() === isoDate(ET_ZONE)) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

// fmtGameTime mirrors the CLI's formatGameTime: always show the game's Eastern
// (league) time, and append the viewer's local time + zone abbreviation only
// when it differs — e.g. "9:07 PM ET · 6:07 PM PDT", or just "9:07 PM ET" for a
// viewer already in Eastern. When the local time falls on a different calendar
// day than the Eastern game day, the local weekday is appended.
export function fmtGameTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const etTime = new Intl.DateTimeFormat(undefined, {
    timeZone: ET_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  const et = `${etTime} ET`;
  if (zoneAbbr(date, ET_ZONE) === zoneAbbr(date)) return et;
  const local = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
  const dayLabel = localDayLabel(date);
  return `${et} · ${local}${dayLabel ? ` · ${dayLabel}` : ""}`;
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

export type DatedGame = {
  gamePk: number;
  status?: { abstractGameState?: string };
  gameDate?: string;
};

// gamesForDay returns the games for one day exactly as the MLB schedule files
// them: `slate` is the API's game list for the selected date. When that date is
// today it also folds in any game from the neighbouring days that is currently
// live, so an active game filed under another timezone's date still shows.
// De-duped by gamePk and ordered by start time. No reshuffling across days: a
// finished game stays on the single day the API assigned it.
export function gamesForDay<T extends DatedGame>(
  slate: T[],
  neighbors: T[],
  isToday: boolean,
): T[] {
  const byPk = new Map<number, T>();
  for (const g of slate) {
    if (!byPk.has(g.gamePk)) byPk.set(g.gamePk, g);
  }
  if (isToday) {
    for (const g of neighbors) {
      if (g.status?.abstractGameState === "Live" && !byPk.has(g.gamePk)) {
        byPk.set(g.gamePk, g);
      }
    }
  }
  const out = [...byPk.values()];
  out.sort((a, b) => (a.gameDate ?? "").localeCompare(b.gameDate ?? ""));
  return out;
}
