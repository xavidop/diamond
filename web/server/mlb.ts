// Minimal fetch-based MLB Stats API client for the DiamondGPT backend.
// Node 20+ provides a global fetch. Each method returns the raw MLB JSON,
// which the Genkit tools serialize back to the model.
export const MLB_BASE = 'https://statsapi.mlb.com/api/v1';
export const MLB_BASE_V11 = 'https://statsapi.mlb.com/api/v1.1';

type Params = Record<string, string | number | undefined>;

export function buildUrl(base: string, path: string, params?: Params): string {
  const url = new URL(path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function mlbFetch<T = unknown>(
  path: string,
  params?: Params,
  base: string = MLB_BASE
): Promise<T> {
  const url = buildUrl(base, path, params);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MLB API ${res.status} ${res.statusText} :: ${url}${text ? ` :: ${text.slice(0, 200)}` : ''}`);
  }
  return (await res.json()) as T;
}

const yearNow = () => String(new Date().getFullYear());

export const mlb = {
  schedule: (date: string) =>
    mlbFetch('/schedule', { sportId: 1, date, hydrate: 'team,linescore,probablePitcher,decisions' }),
  standings: (season: string) =>
    mlbFetch('/standings', { leagueId: '103,104', season, standingsTypes: 'regularSeason', hydrate: 'team' }),
  wildcard: (season: string) =>
    mlbFetch('/standings', { leagueId: '103,104', season, standingsTypes: 'wildCard', hydrate: 'team' }),
  leaders: (group: string, category: string, season: string) =>
    mlbFetch('/stats/leaders', { leaderCategories: category, statGroup: group, season, sportId: 1, limit: 10 }),
  searchPlayer: (name: string) =>
    mlbFetch('/people/search', { names: name, sportId: 1 }),
  person: (id: number, season: string) =>
    mlbFetch(`/people/${id}`, { hydrate: `stats(group=[hitting,pitching],type=[season,career],season=${season})` }),
  personGameLog: (id: number, group: string, season: string) =>
    mlbFetch(`/people/${id}`, { hydrate: `stats(group=[${group}],type=[gameLog],season=${season})` }),
  personSplits: (id: number, group: string, season: string) =>
    mlbFetch(`/people/${id}`, { hydrate: `stats(group=[${group}],type=[statSplits],sitCodes=[vl,vr,h,a,d,n,risp],season=${season})` }),
  teams: () =>
    mlbFetch('/teams', { sportId: 1 }),
  teamRoster: (teamId: number) =>
    mlbFetch(`/teams/${teamId}/roster`, { rosterType: 'active' }),
  teamStats: (teamId: number, group: string, season: string) =>
    mlbFetch(`/teams/${teamId}/stats`, { stats: 'season', group, season }),
  awards: (awardId: string, season: string) =>
    mlbFetch(`/awards/${awardId}/recipients`, { season }),
  postseason: (season: string) =>
    mlbFetch('/schedule/postseason', { season, sportId: 1, hydrate: 'team,linescore' }),
  draft: (year: string) =>
    mlbFetch(`/draft/${year}`),
  venues: () =>
    mlbFetch('/venues'),
  venue: (venueId: number) =>
    mlbFetch(`/venues/${venueId}`, { hydrate: 'location,fieldInfo,timezone' }),
  statsByDateRange: (group: string, start: string, end: string, sortStat: string, order: string) =>
    mlbFetch('/stats', { stats: 'byDateRange', group, startDate: start, endDate: end, sortStat, order, sportId: 1, limit: 10 }),
  winProbability: (gamePk: number) =>
    mlbFetch(`/game/${gamePk}/winProbability`),
};

export const currentSeason = yearNow;
