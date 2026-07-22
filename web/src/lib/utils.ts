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

export type SpilloverGame = {
  gamePk: number;
  status?: { abstractGameState?: string };
  gameDate?: string;
};

// A single MLB slate's games all start within ~12h; this bounds how far back a
// finished adjacent-day game can have started and still count as "today".
const SPILLOVER_PAST_MS = 12 * 60 * 60 * 1000;
// How far into the future an adjacent-slate game may start and still count as
// "today": for a viewer east of the US, this evening's US games are filed under
// the previous local date and haven't started yet, so they'd otherwise be
// dropped. One slate's remaining games all begin within a few hours.
const SPILLOVER_UPCOMING_MS = 6 * 60 * 60 * 1000;

// mergeRecentSpillover returns primary plus any adjacent-day game that belongs
// to the same rolling window and isn't already present: still Live, started
// within the last 12h, or starting within the next 6h. The MLB schedule files
// a game under the US date it's played, so for a viewer east of the US (e.g.
// Spain) tonight's US games land under the previous local date — live, just
// finished, or about to start. Keying off the game's absolute start time
// (gameDate, UTC) rather than the local calendar date keeps them on "today"
// regardless of timezone, instead of the page jumping to the next slate at
// local midnight and hiding games that are on now or imminent.
export function mergeRecentSpillover<T extends SpilloverGame>(
  primary: T[],
  adjacent: T[],
  now: Date = new Date(),
): T[] {
  const seen = new Set(primary.map((g) => g.gamePk));
  const out = [...primary];
  const nowMs = now.getTime();
  const past = nowMs - SPILLOVER_PAST_MS;
  const ahead = nowMs + SPILLOVER_UPCOMING_MS;
  for (const g of adjacent) {
    if (seen.has(g.gamePk)) continue;
    let keep = g.status?.abstractGameState === "Live";
    if (!keep && g.gameDate) {
      const start = new Date(g.gameDate).getTime();
      keep = !Number.isNaN(start) && start >= past && start <= ahead;
    }
    if (keep) {
      out.push(g);
      seen.add(g.gamePk);
    }
  }
  return out;
}
