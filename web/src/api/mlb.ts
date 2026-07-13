export const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";
export const MLB_API_BASE_V11 = "https://statsapi.mlb.com/api/v1.1";

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

function buildUrl(base: string, path: string, params?: QueryParams) {
  const url = new URL(
    path.startsWith("/") ? `${base}${path}` : `${base}/${path}`
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function mlbFetch<T = unknown>(
  path: string,
  params?: QueryParams,
  opts: { base?: string } = {}
): Promise<T> {
  const url = buildUrl(opts.base ?? MLB_API_BASE, path, params);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `MLB API ${res.status} ${res.statusText} :: ${url}${
        text ? ` :: ${text.slice(0, 200)}` : ""
      }`
    );
  }
  return (await res.json()) as T;
}

export async function mlbFetchRaw(
  path: string,
  params?: QueryParams,
  opts: { base?: string } = {}
): Promise<{ url: string; status: number; data: unknown }> {
  const url = buildUrl(opts.base ?? MLB_API_BASE, path, params);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : await res.text();
  return { url, status: res.status, data };
}

/* -------- Typed endpoint helpers (subset; the Explorer covers the rest) -------- */

export const api = {
  schedule: (params: QueryParams = {}) =>
    mlbFetch<any>("/schedule", {
      sportId: 1,
      hydrate: "team,linescore,probablePitcher,decisions",
      ...params,
    }),

  standings: (params: QueryParams = {}) =>
    mlbFetch<any>("/standings", {
      season: params.season ?? new Date().getFullYear(),
      standingsTypes: "regularSeason",
      hydrate: "team",
      ...params,
    }),

  teams: (params: QueryParams = {}) =>
    mlbFetch<any>("/teams", {
      sportId: 1,
      season: params.season ?? new Date().getFullYear(),
      ...params,
    }),

  team: (teamId: number | string, params: QueryParams = {}) =>
    mlbFetch<any>(`/teams/${teamId}`, {
      hydrate: "league,division,venue",
      ...params,
    }),

  teamRoster: (teamId: number | string, params: QueryParams = {}) =>
    mlbFetch<any>(`/teams/${teamId}/roster`, {
      rosterType: "active",
      ...params,
    }),

  // Farm system: a club's minor-league affiliates (and parentOrg linkage).
  teamAffiliates: (teamId: number | string, season: number | string) =>
    mlbFetch<any>(`/teams/${teamId}/affiliates`, { season }),

  // Coaching staff
  teamCoaches: (teamId: number | string, season: number | string) =>
    mlbFetch<any>(`/teams/${teamId}/coaches`, { season }),

  // Per-team stat leaders (multiple categories in one call)
  teamLeaders: (
    teamId: number | string,
    leaderCategories: string,
    season: number | string
  ) =>
    mlbFetch<any>(`/teams/${teamId}/leaders`, {
      leaderCategories,
      season,
      limit: 3,
    }),

  teamStats: (teamId: number | string, params: QueryParams = {}) =>
    mlbFetch<any>(`/teams/${teamId}/stats`, {
      stats: "season",
      group: "hitting,pitching",
      season: params.season ?? new Date().getFullYear(),
      ...params,
    }),

  person: (personId: number | string, params: QueryParams = {}) =>
    mlbFetch<any>(`/people/${personId}`, {
      hydrate:
        "currentTeam,team,awards,education,stats(group=[hitting,pitching,fielding],type=[yearByYear,career,statsSingleSeason])",
      ...params,
    }),

  personStats: (personId: number | string, params: QueryParams = {}) =>
    mlbFetch<any>(`/people/${personId}/stats/game/current`, params),

  game: (gamePk: number | string) =>
    mlbFetch<any>(`/game/${gamePk}/feed/live`, undefined, {
      base: MLB_API_BASE_V11,
    }),

  gameBoxscore: (gamePk: number | string) =>
    mlbFetch<any>(`/game/${gamePk}/boxscore`),

  gameLinescore: (gamePk: number | string) =>
    mlbFetch<any>(`/game/${gamePk}/linescore`),

  gamePlayByPlay: (gamePk: number | string) =>
    mlbFetch<any>(`/game/${gamePk}/playByPlay`),

  gameContent: (gamePk: number | string) =>
    mlbFetch<any>(`/game/${gamePk}/content`),

  statsLeaders: (params: QueryParams = {}) =>
    mlbFetch<any>("/stats/leaders", {
      sportId: 1,
      season: params.season ?? new Date().getFullYear(),
      limit: 25,
      ...params,
    }),

  meta: (type: string) => mlbFetch<any>(`/${type}`),

  search: (query: string, params: QueryParams = {}) =>
    mlbFetch<any>("/people/search", { names: query, sportId: 1, ...params }),

  venues: (params: QueryParams = {}) => mlbFetch<any>("/venues", params),
  venue: (venueId: number | string, params: QueryParams = {}) =>
    mlbFetch<any>(`/venues/${venueId}`, { hydrate: "location,fieldInfo,timezone", ...params }),
  divisions: () => mlbFetch<any>("/divisions"),
  leagues: (params: QueryParams = {}) =>
    mlbFetch<any>("/leagues", { sportId: 1, ...params }),
  sports: () => mlbFetch<any>("/sports"),
  seasons: (params: QueryParams = {}) =>
    mlbFetch<any>("/seasons", { sportId: 1, ...params }),

  // Transactions feed (date-bounded)
  transactions: (params: QueryParams = {}) =>
    mlbFetch<any>("/transactions", { sportId: 1, ...params }),

  // Awards catalog + recipients
  awards: () => mlbFetch<any>("/awards"),
  awardRecipients: (awardId: string, params: QueryParams = {}) =>
    mlbFetch<any>(`/awards/${awardId}/recipients`, params),

  // Player splits / vs-pitcher matchup
  personSplits: (
    personId: number | string,
    statType: "statSplits" | "vsPlayer" | "vsTeam",
    params: QueryParams = {}
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: statType,
      group: "hitting,pitching",
      season: params.season ?? new Date().getFullYear(),
      ...params,
    }),

  // Probable pitchers — schedule already returns probablePitcher with the hydrate string
  probables: (params: QueryParams = {}) =>
    mlbFetch<any>("/schedule", {
      sportId: 1,
      hydrate:
        "team,probablePitcher(stats(group=pitching,type=season)),linescore",
      ...params,
    }),

  // Date-range stats (hot/cold streaks)
  statsByDateRange: (params: QueryParams = {}) =>
    mlbFetch<any>("/stats", {
      stats: "byDateRange",
      sportIds: 1,
      limit: 50,
      ...params,
    }),

  // Per-game log for a player (used by sparkline + recent results)
  personGameLog: (
    personId: number | string,
    group: "hitting" | "pitching",
    season?: number | string
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "gameLog",
      group,
      season: season ?? new Date().getFullYear(),
    }),

  // Promotion trail: yearByYear stats at a specific level (sportId). Fanned out
  // per level because a comma-list of sportIds does not combine server-side.
  personStatsAtLevel: (
    personId: number | string,
    group: "hitting" | "pitching",
    sportId: number
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "yearByYear",
      group,
      sportId,
      hydrate: "team(sport)",
    }),

  // Advanced sabermetrics — WAR/wRC+ (hitting), WAR/FIP/xFIP (pitching)
  personSabermetrics: (
    personId: number | string,
    group: "hitting" | "pitching",
    season: number | string
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "sabermetrics",
      group,
      season,
    }),

  // Fielding stats by position
  personFielding: (personId: number | string, season: number | string) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "season",
      group: "fielding",
      season,
    }),

  // Hot/cold zones — strike-zone heat map (13 zones × several metrics)
  personHotColdZones: (
    personId: number | string,
    group: "hitting" | "pitching",
    season: number | string
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "hotColdZones",
      group,
      season,
    }),

  // ZiPS rest-of-season projections
  personProjections: (
    personId: number | string,
    group: "hitting" | "pitching"
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "projectedRos",
      group,
    }),

  // Statcast expected statistics (xBA/xSLG/xwOBA under ordinary stat names)
  personExpectedStats: (
    personId: number | string,
    group: "hitting" | "pitching",
    season: number | string
  ) =>
    mlbFetch<any>(`/people/${personId}/stats`, {
      stats: "expectedStatistics",
      group,
      season,
    }),

  // Baseball Savant percentile rankings — proxied through our backend (CORS).
  // Best-effort: returns { ok:false } on any failure, never throws.
  savantPercentiles: async (
    playerId: number | string,
    type: "batter" | "pitcher",
    season: number | string
  ) => {
    try {
      const res = await fetch(
        `/api/savant/percentiles/${playerId}?type=${type}&season=${season}`
      );
      if (!res.ok) return { ok: false as const };
      return (await res.json()) as
        | {
            ok: true;
            season: number;
            percentiles: { key: string; label: string; value: number }[];
          }
        | { ok: false };
    } catch {
      return { ok: false as const };
    }
  },

  // Postseason bracket — all postseason games for a season
  postseason: (season: number | string, sportId: number | string = 1) =>
    mlbFetch<any>("/schedule/postseason", {
      season,
      sportId,
      hydrate:
        "team,linescore,decisions,probablePitcher,broadcasts,seriesStatus",
    }),

  // Dedicated win-probability endpoint
  gameWinProbability: (gamePk: number | string) =>
    mlbFetch<any>(`/game/${gamePk}/winProbability`),

  // Multi-team stats (team comparison)
  teamsStats: (
    teamIds: (number | string)[],
    params: QueryParams = {}
  ) =>
    mlbFetch<any>("/teams/stats", {
      sportIds: 1,
      teamIds: teamIds.join(","),
      stats: "season",
      group: "hitting,pitching",
      season: params.season ?? new Date().getFullYear(),
      ...params,
    }),
};

export function playerHeadshotUrl(personId: number | string, size = 213) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${size},q_auto:best/v1/people/${personId}/headshot/67/current`;
}

export function teamLogoUrl(teamId: number | string) {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}
