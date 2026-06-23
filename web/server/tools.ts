import { genkit, z } from 'genkit';
import { mlb, currentSeason } from './mlb.ts';

type Genkit = ReturnType<typeof genkit>;

const seasonOr = (s?: string) => (s && s.trim() ? s : currentSeason());
const todayIso = () => new Date().toISOString().slice(0, 10);
const j = (v: unknown) => JSON.stringify(v);

// Each tool returns a JSON string of the live MLB response. Names and
// descriptions match the CLI's tools so DiamondGPT behaves identically.
export function defineTools(ai: Genkit) {
  return [
    ai.defineTool(
      { name: 'mlb_schedule', description: 'List MLB games for a date (scores, status, start time). Empty date = today.',
        inputSchema: z.object({ date: z.string().optional().describe('Date YYYY-MM-DD; empty means today') }), outputSchema: z.string() },
      async (i) => j(await mlb.schedule(i.date && i.date.trim() ? i.date : todayIso())),
    ),
    ai.defineTool(
      { name: 'mlb_standings', description: 'MLB division standings (W-L, win%, games back) for a season.',
        inputSchema: z.object({ season: z.string().optional().describe('Season year; empty means current') }), outputSchema: z.string() },
      async (i) => j(await mlb.standings(seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_wildcard_standings', description: 'MLB wild card standings (the wild card race) for a season.',
        inputSchema: z.object({ season: z.string().optional().describe('Season year; empty means current') }), outputSchema: z.string() },
      async (i) => j(await mlb.wildcard(seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_stat_leaders', description: 'League leaders for a stat category (top players).',
        inputSchema: z.object({
          group: z.string().optional().describe("'hitting' (default) or 'pitching'"),
          category: z.string().optional().describe('e.g. homeRuns (default), battingAverage, rbi, onBasePlusSlugging, earnedRunAverage, strikeouts, wins, saves, whip'),
          season: z.string().optional().describe('Season year; empty means current'),
        }), outputSchema: z.string() },
      async (i) => j(await mlb.leaders(i.group || 'hitting', i.category || 'homeRuns', seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_search_player', description: 'Search active MLB players by name; returns player IDs for other tools.',
        inputSchema: z.object({ name: z.string().describe('Full or partial name') }), outputSchema: z.string() },
      async (i) => j(await mlb.searchPlayer(i.name)),
    ),
    ai.defineTool(
      { name: 'mlb_player', description: 'Full bio + season/career stats for a player by ID (get the ID from mlb_search_player).',
        inputSchema: z.object({
          playerId: z.number().describe('MLB player ID from mlb_search_player'),
          season: z.string().optional().describe('Season year; empty means current'),
        }), outputSchema: z.string() },
      async (i) => j(await mlb.person(i.playerId, seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_player_gamelog', description: "Per-game log for a player (group 'hitting' or 'pitching').",
        inputSchema: z.object({
          playerId: z.number().describe('MLB player ID'),
          group: z.string().optional().describe("'hitting' (default) or 'pitching'"),
          season: z.string().optional().describe('Season year; empty means current'),
        }), outputSchema: z.string() },
      async (i) => j(await mlb.personGameLog(i.playerId, i.group || 'hitting', seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_player_splits', description: 'Situational splits for a player (vs LHP/RHP, home/away, day/night, RISP, …).',
        inputSchema: z.object({
          playerId: z.number().describe('MLB player ID'),
          group: z.string().optional().describe("'hitting' (default) or 'pitching'"),
          season: z.string().optional().describe('Season year; empty means current'),
        }), outputSchema: z.string() },
      async (i) => j(await mlb.personSplits(i.playerId, i.group || 'hitting', seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_teams', description: 'List all MLB teams with their IDs (use the IDs for roster/stats tools).',
        inputSchema: z.object({}), outputSchema: z.string() },
      async () => j(await mlb.teams()),
    ),
    ai.defineTool(
      { name: 'mlb_team_roster', description: 'Active roster for a team by ID.',
        inputSchema: z.object({ teamId: z.number().describe('MLB team ID from mlb_teams') }), outputSchema: z.string() },
      async (i) => j(await mlb.teamRoster(i.teamId)),
    ),
    ai.defineTool(
      { name: 'mlb_team_stats', description: 'Season hitting or pitching stats for a team by ID.',
        inputSchema: z.object({
          teamId: z.number().describe('MLB team ID from mlb_teams'),
          group: z.string().optional().describe("'hitting' (default) or 'pitching'"),
          season: z.string().optional().describe('Season year; empty means current'),
        }), outputSchema: z.string() },
      async (i) => j(await mlb.teamStats(i.teamId, i.group || 'hitting', seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_awards', description: 'Award recipients for an award id (ALMVP, NLCY, …) and season.',
        inputSchema: z.object({
          awardId: z.string().describe('Award id, e.g. ALMVP, NLMVP, ALCY, NLCY, ALROY, NLROY, WSMVP'),
          season: z.string().optional().describe('Season year; empty means current'),
        }), outputSchema: z.string() },
      async (i) => j(await mlb.awards(i.awardId, seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_postseason', description: 'All postseason games (wild card → World Series) for a season.',
        inputSchema: z.object({ season: z.string().optional().describe('Season year; empty means current') }), outputSchema: z.string() },
      async (i) => j(await mlb.postseason(seasonOr(i.season))),
    ),
    ai.defineTool(
      { name: 'mlb_draft', description: 'MLB draft rounds and picks for a year (empty = last year).',
        inputSchema: z.object({ year: z.string().optional().describe('Draft year, e.g. 2024; empty means last year') }), outputSchema: z.string() },
      async (i) => j(await mlb.draft(i.year && i.year.trim() ? i.year : String(new Date().getFullYear() - 1))),
    ),
    ai.defineTool(
      { name: 'mlb_venues', description: 'List MLB ballparks with their IDs.',
        inputSchema: z.object({}), outputSchema: z.string() },
      async () => j(await mlb.venues()),
    ),
    ai.defineTool(
      { name: 'mlb_venue', description: 'Detailed info (dimensions, capacity, location) for a ballpark by ID.',
        inputSchema: z.object({ venueId: z.number().describe('Venue ID from mlb_venues') }), outputSchema: z.string() },
      async (i) => j(await mlb.venue(i.venueId)),
    ),
    ai.defineTool(
      { name: 'mlb_date_range_stats', description: 'Leaders over a custom date window (for hot/cold streaks). Provide group, sortStat, startDate, endDate.',
        inputSchema: z.object({
          group: z.string().optional().describe("'hitting' (default) or 'pitching'"),
          sortStat: z.string().optional().describe('Stat to sort by, e.g. homeRuns (default), battingAverage, earnedRunAverage'),
          startDate: z.string().optional().describe('YYYY-MM-DD; empty means 7 days ago'),
          endDate: z.string().optional().describe('YYYY-MM-DD; empty means today'),
          order: z.string().optional().describe("'desc' (default) or 'asc' for lower-is-better stats"),
        }), outputSchema: z.string() },
      async (i) => {
        const end = i.endDate && i.endDate.trim() ? i.endDate : todayIso();
        const start = i.startDate && i.startDate.trim()
          ? i.startDate
          : new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
        return j(await mlb.statsByDateRange(i.group || 'hitting', start, end, i.sortStat || 'homeRuns', i.order || 'desc'));
      },
    ),
    ai.defineTool(
      { name: 'mlb_win_probability', description: 'Win-probability time series for a game by gamePk.',
        inputSchema: z.object({ gamePk: z.number().describe('Game primary key (gamePk) from mlb_schedule') }), outputSchema: z.string() },
      async (i) => j(await mlb.winProbability(i.gamePk)),
    ),
  ];
}
