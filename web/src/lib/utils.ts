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

// fmtGameTime mirrors the CLI's formatGameTime: always show the game's Eastern
// (league) time, and append the viewer's local time + zone abbreviation only
// when it differs — e.g. "9:07 PM ET · 6:07 PM PDT", or just "9:07 PM ET" for a
// viewer already in Eastern.
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
  return `${et} · ${local}`;
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
  status?: { abstractGameState?: string; detailedState?: string };
  gameDate?: string;
};

// localDateOf returns the YYYY-MM-DD calendar date of an instant in the
// viewer's local timezone — the same local-day math as todayIso. Empty string
// for an unparseable date.
export function localDateOf(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

// A postponed/cancelled entry is a "ghost": the MLB schedule keeps it under its
// original date even after the game is replayed, so the same gamePk comes back
// in two slates with different gameDates. The ghost must never win dedup.
function isGhost(g: DatedGame): boolean {
  return /postponed|cancel/i.test(g.status?.detailedState ?? "");
}

// bucketDay decides which local calendar day a game belongs to. A live game
// belongs to *today* — one that started before local midnight and is still
// going shows on the current day; everything else belongs to the local day it
// started, so a finished game stays on the day it was actually played.
export function bucketDay(g: DatedGame, todayIso: string): string {
  if (g.status?.abstractGameState === "Live") return todayIso;
  return localDateOf(g.gameDate ?? "");
}

// gamesForDay returns the games that belong to `viewDate` (a local YYYY-MM-DD)
// given today's local date. MLB files each game under its US date, so a night
// game shows up in two adjacent US slates for viewers far from Eastern (an 8pm
// ET game is 2am the next day in Spain); callers fetch the neighbouring slates
// so every candidate is available. Games are de-duped by gamePk (preferring the
// real entry over a postponed ghost), bucketed by bucketDay, and ordered by
// start time, so each game lands on exactly one calendar day.
export function gamesForDay<T extends DatedGame>(
  games: T[],
  viewDate: string,
  todayIso: string,
): T[] {
  const byPk = new Map<number, T>();
  for (const g of games) {
    const prev = byPk.get(g.gamePk);
    if (!prev || (isGhost(prev) && !isGhost(g))) byPk.set(g.gamePk, g);
  }
  const out: T[] = [];
  for (const g of byPk.values()) {
    if (bucketDay(g, todayIso) === viewDate) out.push(g);
  }
  out.sort((a, b) => (a.gameDate ?? "").localeCompare(b.gameDate ?? ""));
  return out;
}
