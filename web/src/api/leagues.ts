/**
 * Leagues are the MLB Stats API's sub-level under a sport:
 *   sportId (1 = MLB, 17 = Winter Leagues, …) → leagueId (103 = AL, 131 = LIDOM, …)
 *
 * For MLB the two leagues are halves of one competition, so the app never
 * filters by them. For sport 17 "Winter Leagues" (and a few others) every
 * league is its own competition — LIDOM, LVBP, LMP, LBPRC, AFL, ABL and the
 * Caribbean Series all run at once — so the app exposes a league filter and
 * tags each game with its league. The `leagueId` query param is accepted by
 * /schedule, /standings, /teams and /stats/leaders; game/team payloads carry
 * `team.league.{id,name}` when hydrated with `team`.
 */
export type League = {
  id: number;
  sportId: number;
  abbreviation: string;
  name: string;
  nameShort?: string;
};

/**
 * Sports whose leagues are independent competitions worth filtering by.
 * 17 = Winter Leagues, 23 = Independent Leagues, 51 = International Baseball.
 */
export const MULTI_LEAGUE_SPORTS: ReadonlySet<number> = new Set([17, 23, 51]);

export function sportHasSubleagues(sportId: number): boolean {
  return MULTI_LEAGUE_SPORTS.has(sportId);
}

/**
 * The API's abbreviations for a few winter leagues are not what fans use
 * (DWL for LIDOM, VWL for LVBP, PWL for LBPRC). Prefer the familiar ones.
 */
const ABBR_OVERRIDES: Record<number, string> = {
  131: "LIDOM",
  135: "LVBP",
  133: "LBPRC",
};

/**
 * Snapshot of /api/v1/league?sportId=17 so the league picker renders instantly
 * and still works offline. `useLeagues` refreshes it from the API.
 */
export const WINTER_LEAGUES: League[] = [
  { id: 131, sportId: 17, abbreviation: "LIDOM", name: "Liga de Béisbol Dominicano", nameShort: "Dominican" },
  { id: 135, sportId: 17, abbreviation: "LVBP", name: "Liga Venezolana de Béisbol Profesional", nameShort: "Venezuela" },
  { id: 132, sportId: 17, abbreviation: "LMP", name: "Liga Mexicana del Pacífico", nameShort: "Mexican Pacific" },
  { id: 133, sportId: 17, abbreviation: "LBPRC", name: "Liga de Béisbol Profesional Roberto Clemente", nameShort: "Puerto Rico" },
  { id: 119, sportId: 17, abbreviation: "AFL", name: "Arizona Fall League", nameShort: "Arizona Fall" },
  { id: 595, sportId: 17, abbreviation: "ABL", name: "Australian Baseball League", nameShort: "Australia" },
  { id: 162, sportId: 17, abbreviation: "CS", name: "Caribbean Series", nameShort: "Serie del Caribe" },
];

/** Static leagues known for a sport (empty when we rely on the API alone). */
export function staticLeagues(sportId: number): League[] {
  return sportId === 17 ? WINTER_LEAGUES : [];
}

/** Shape a raw /league entry into a League, applying abbreviation overrides. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeLeague(raw: any, sportId: number): League {
  const id = Number(raw?.id);
  const snapshot = staticLeagues(sportId).find((l) => l.id === id);
  return {
    id,
    sportId,
    abbreviation:
      ABBR_OVERRIDES[id] ??
      snapshot?.abbreviation ??
      raw?.abbreviation ??
      raw?.nameShort ??
      String(id),
    name: snapshot?.name ?? raw?.name ?? snapshot?.abbreviation ?? String(id),
    nameShort: snapshot?.nameShort ?? raw?.nameShort,
  };
}

/**
 * Merge API leagues over the static snapshot: API order wins, snapshot fills in
 * anything the API omitted (e.g. a league whose season has not started).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeLeagues(apiLeagues: any[] | undefined, sportId: number): League[] {
  const out: League[] = [];
  const seen = new Set<number>();
  for (const raw of apiLeagues ?? []) {
    // The API also lists defunct leagues (e.g. Hawaii Winter Baseball) as
    // inactive; they have no games or standings, so keep them out of the picker.
    if (raw?.active === false) continue;
    const l = normalizeLeague(raw, sportId);
    if (!Number.isFinite(l.id) || seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
  }
  for (const l of staticLeagues(sportId)) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      out.push(l);
    }
  }
  return out;
}

/** Minimal game shape needed to find its league (schedule hydrated with `team`). */
export type LeagueTaggedGame = {
  teams?: {
    home?: { team?: { league?: { id?: number; name?: string } } };
    away?: { team?: { league?: { id?: number; name?: string } } };
  };
};

/** The league a game belongs to: home team's league, else away's. */
export function gameLeagueId(game: LeagueTaggedGame | undefined): number | undefined {
  const id = game?.teams?.home?.team?.league?.id ?? game?.teams?.away?.team?.league?.id;
  return typeof id === "number" ? id : undefined;
}

/** Games in the given league; `null`/`undefined` means "all leagues". */
export function filterGamesByLeague<T extends LeagueTaggedGame>(
  games: T[],
  leagueId: number | null | undefined
): T[] {
  if (leagueId == null) return games;
  return games.filter((g) => gameLeagueId(g) === leagueId);
}

/**
 * Games back for a standings row. Within a division the API's `gamesBack` is
 * behind the division leader. For division-less leagues (the winter leagues)
 * `gamesBack` is measured from the playoff cutoff instead — leaders come out
 * negative — so use the behind-the-leader `leagueGamesBack` there.
 */
export function standingsGamesBack(
  hasDivision: boolean,
  row: { gamesBack?: string; leagueGamesBack?: string } | undefined
): string | undefined {
  if (!row) return undefined;
  if (!hasDivision && row.leagueGamesBack) return row.leagueGamesBack;
  return row.gamesBack;
}

/** Abbreviation for a league id from a list, falling back to the game's own league name. */
export function leagueAbbr(
  leagues: League[],
  leagueId: number | undefined,
  fallbackName?: string
): string | undefined {
  if (leagueId == null) return undefined;
  const l = leagues.find((x) => x.id === leagueId);
  return l?.abbreviation ?? ABBR_OVERRIDES[leagueId] ?? fallbackName;
}
