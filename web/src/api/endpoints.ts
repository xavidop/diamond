/**
 * A curated catalog of MLB Stats API endpoints used by the API Explorer.
 * Source: https://statsapi.mlb.com/docs/  (public, undocumented but widely used)
 */
export type ParamDef = {
  name: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  help?: string;
};

export type EndpointDef = {
  id: string;
  category: string;
  name: string;
  method: "GET";
  path: string; // can contain {placeholders}
  description: string;
  pathParams?: ParamDef[];
  queryParams?: ParamDef[];
  base?: "v1" | "v1.1";
};

const today = new Date().toISOString().slice(0, 10);
const season = String(new Date().getFullYear());

export const ENDPOINTS: EndpointDef[] = [
  // ---------- Schedule ----------
  {
    id: "schedule",
    category: "Schedule",
    name: "Schedule",
    method: "GET",
    path: "/schedule",
    description: "Games for a date / date range. Hydrate for more detail.",
    queryParams: [
      { name: "sportId", defaultValue: "1" },
      { name: "date", placeholder: "YYYY-MM-DD", defaultValue: today },
      { name: "startDate", placeholder: "YYYY-MM-DD" },
      { name: "endDate", placeholder: "YYYY-MM-DD" },
      { name: "teamId" },
      { name: "gameType", placeholder: "R,F,D,L,W,S,E,A,P" },
      {
        name: "hydrate",
        defaultValue: "team,linescore,probablePitcher,decisions",
      },
    ],
  },
  {
    id: "scheduleTied",
    category: "Schedule",
    name: "Tied Games",
    method: "GET",
    path: "/schedule/games/tied",
    description: "Historical tied games.",
    queryParams: [{ name: "season", defaultValue: season }],
  },
  {
    id: "schedulePostseason",
    category: "Schedule",
    name: "Postseason Series",
    method: "GET",
    path: "/schedule/postseason/series",
    description: "Postseason series schedule.",
    queryParams: [{ name: "season", defaultValue: season }],
  },

  // ---------- Standings ----------
  {
    id: "standings",
    category: "Standings",
    name: "Standings",
    method: "GET",
    path: "/standings",
    description: "League/Division standings.",
    queryParams: [
      { name: "leagueId", defaultValue: "103,104" },
      { name: "season", defaultValue: season },
      { name: "standingsTypes", defaultValue: "regularSeason" },
      { name: "hydrate", defaultValue: "team" },
      { name: "date", placeholder: "YYYY-MM-DD" },
    ],
  },
  {
    id: "standingsTypes",
    category: "Standings",
    name: "Standings Types",
    method: "GET",
    path: "/standingsTypes",
    description: "All valid standingsTypes values.",
  },

  // ---------- Teams ----------
  {
    id: "teams",
    category: "Teams",
    name: "All Teams",
    method: "GET",
    path: "/teams",
    description: "List teams (filter by sportId, season, leagueId).",
    queryParams: [
      { name: "sportId", defaultValue: "1" },
      { name: "season", defaultValue: season },
      { name: "leagueIds" },
      { name: "activeStatus", placeholder: "Y, N, B" },
    ],
  },
  {
    id: "team",
    category: "Teams",
    name: "Team by ID",
    method: "GET",
    path: "/teams/{teamId}",
    description: "Single team details.",
    pathParams: [
      { name: "teamId", required: true, defaultValue: "147", help: "e.g. 147" },
    ],
    queryParams: [{ name: "hydrate", defaultValue: "league,division,venue" }],
  },
  {
    id: "teamRoster",
    category: "Teams",
    name: "Team Roster",
    method: "GET",
    path: "/teams/{teamId}/roster",
    description: "Roster (active, 40man, fullSeason, etc).",
    pathParams: [{ name: "teamId", required: true, defaultValue: "147" }],
    queryParams: [
      {
        name: "rosterType",
        defaultValue: "active",
        placeholder: "active|40Man|fullSeason|fullRoster|nonRosterInvitees",
      },
      { name: "season", defaultValue: season },
      { name: "date", placeholder: "YYYY-MM-DD" },
    ],
  },
  {
    id: "teamStats",
    category: "Teams",
    name: "Team Stats",
    method: "GET",
    path: "/teams/{teamId}/stats",
    description: "Team stats by group / type / season.",
    pathParams: [{ name: "teamId", required: true, defaultValue: "147" }],
    queryParams: [
      { name: "stats", defaultValue: "season" },
      { name: "group", defaultValue: "hitting,pitching" },
      { name: "season", defaultValue: season },
    ],
  },
  {
    id: "teamLeaders",
    category: "Teams",
    name: "Team Leaders",
    method: "GET",
    path: "/teams/{teamId}/leaders",
    description: "Statistical leaders within a team.",
    pathParams: [{ name: "teamId", required: true, defaultValue: "147" }],
    queryParams: [
      { name: "leaderCategories", defaultValue: "homeRuns" },
      { name: "season", defaultValue: season },
      { name: "limit", defaultValue: "10" },
    ],
  },
  {
    id: "affiliates",
    category: "Teams",
    name: "Team Affiliates",
    method: "GET",
    path: "/teams/affiliates",
    description: "Affiliate teams for a parent club.",
    queryParams: [{ name: "teamIds", defaultValue: "147" }],
  },

  // ---------- People ----------
  {
    id: "people",
    category: "People",
    name: "Person by ID",
    method: "GET",
    path: "/people/{personId}",
    description: "Player or person details. Hydrate for stats.",
    pathParams: [
      { name: "personId", required: true, defaultValue: "660271" },
    ],
    queryParams: [
      {
        name: "hydrate",
        defaultValue:
          "currentTeam,team,stats(group=[hitting,pitching,fielding],type=[yearByYear,career])",
      },
    ],
  },
  {
    id: "peopleSearch",
    category: "People",
    name: "Search People",
    method: "GET",
    path: "/people/search",
    description: "Search players by name.",
    queryParams: [
      { name: "names", placeholder: "shohei ohtani", defaultValue: "ohtani" },
      { name: "sportId", defaultValue: "1" },
      { name: "active", placeholder: "true|false" },
    ],
  },
  {
    id: "personStats",
    category: "People",
    name: "Person Stats",
    method: "GET",
    path: "/people/{personId}/stats",
    description: "Player stats by type / group / season.",
    pathParams: [
      { name: "personId", required: true, defaultValue: "660271" },
    ],
    queryParams: [
      { name: "stats", defaultValue: "yearByYear" },
      { name: "group", defaultValue: "hitting" },
      { name: "season", defaultValue: season },
    ],
  },
  {
    id: "personGameCurrent",
    category: "People",
    name: "Person Current Game",
    method: "GET",
    path: "/people/{personId}/stats/game/current",
    description: "Player stats for current/last game.",
    pathParams: [
      { name: "personId", required: true, defaultValue: "660271" },
    ],
  },

  // ---------- Stats ----------
  {
    id: "stats",
    category: "Stats",
    name: "Stats",
    method: "GET",
    path: "/stats",
    description: "Generic stats endpoint. Combine stats / group / playerPool.",
    queryParams: [
      { name: "stats", defaultValue: "season" },
      { name: "group", defaultValue: "hitting" },
      { name: "season", defaultValue: season },
      { name: "sportId", defaultValue: "1" },
      { name: "playerPool", placeholder: "all|qualified|rookies", defaultValue: "qualified" },
      { name: "limit", defaultValue: "25" },
    ],
  },
  {
    id: "statsLeaders",
    category: "Stats",
    name: "Stat Leaders",
    method: "GET",
    path: "/stats/leaders",
    description: "League leaders for a stat category.",
    queryParams: [
      { name: "sportId", defaultValue: "1" },
      { name: "leaderCategories", defaultValue: "homeRuns" },
      { name: "season", defaultValue: season },
      { name: "leagueId", defaultValue: "103,104" },
      { name: "statGroup", placeholder: "hitting|pitching|fielding" },
      { name: "limit", defaultValue: "25" },
    ],
  },
  {
    id: "leagueLeaders",
    category: "Stats",
    name: "League Leaders (legacy)",
    method: "GET",
    path: "/leagueLeaders",
    description: "Alternate league leaders endpoint.",
    queryParams: [
      { name: "leaderCategories", defaultValue: "homeRuns" },
      { name: "season", defaultValue: season },
      { name: "sportId", defaultValue: "1" },
    ],
  },

  // ---------- Game ----------
  {
    id: "gameFeedLive",
    category: "Game",
    name: "Live Feed (v1.1)",
    method: "GET",
    path: "/game/{gamePk}/feed/live",
    description: "Complete live game feed.",
    base: "v1.1",
    pathParams: [
      { name: "gamePk", required: true, defaultValue: "778549" },
    ],
  },
  {
    id: "boxscore",
    category: "Game",
    name: "Boxscore",
    method: "GET",
    path: "/game/{gamePk}/boxscore",
    description: "Game boxscore.",
    pathParams: [{ name: "gamePk", required: true, defaultValue: "778549" }],
  },
  {
    id: "linescore",
    category: "Game",
    name: "Linescore",
    method: "GET",
    path: "/game/{gamePk}/linescore",
    description: "Game linescore.",
    pathParams: [{ name: "gamePk", required: true, defaultValue: "778549" }],
  },
  {
    id: "playByPlay",
    category: "Game",
    name: "Play-by-Play",
    method: "GET",
    path: "/game/{gamePk}/playByPlay",
    description: "All plays in a game.",
    pathParams: [{ name: "gamePk", required: true, defaultValue: "778549" }],
  },
  {
    id: "gameContent",
    category: "Game",
    name: "Game Content",
    method: "GET",
    path: "/game/{gamePk}/content",
    description: "Editorial + media content.",
    pathParams: [{ name: "gamePk", required: true, defaultValue: "778549" }],
  },
  {
    id: "gameWinProbability",
    category: "Game",
    name: "Win Probability",
    method: "GET",
    path: "/game/{gamePk}/winProbability",
    description: "Per-play win probability.",
    pathParams: [{ name: "gamePk", required: true, defaultValue: "778549" }],
  },

  // ---------- Reference Data ----------
  { id: "sports", category: "Reference", name: "Sports", method: "GET", path: "/sports", description: "All sports." },
  { id: "leagues", category: "Reference", name: "Leagues", method: "GET", path: "/leagues", description: "All leagues.", queryParams: [{ name: "sportId", defaultValue: "1" }] },
  { id: "divisions", category: "Reference", name: "Divisions", method: "GET", path: "/divisions", description: "All divisions." },
  { id: "seasons", category: "Reference", name: "Seasons", method: "GET", path: "/seasons", description: "All seasons.", queryParams: [{ name: "sportId", defaultValue: "1" }] },
  { id: "seasonsAll", category: "Reference", name: "All Seasons", method: "GET", path: "/seasons/all", description: "Every season ever.", queryParams: [{ name: "sportId", defaultValue: "1" }] },
  { id: "venues", category: "Reference", name: "Venues", method: "GET", path: "/venues", description: "Venues." },
  { id: "awards", category: "Reference", name: "Awards", method: "GET", path: "/awards", description: "All awards." },
  { id: "draft", category: "Reference", name: "Draft", method: "GET", path: "/draft/{year}", description: "Draft for a year.", pathParams: [{ name: "year", required: true, defaultValue: season }] },
  { id: "jobs", category: "Reference", name: "Jobs", method: "GET", path: "/jobs", description: "Jobs (umpires, etc).", queryParams: [{ name: "jobType", defaultValue: "UMPR" }] },
  { id: "jobTypes", category: "Reference", name: "Job Types", method: "GET", path: "/jobTypes", description: "Job types." },

  // ---------- Meta / Configuration ----------
  ...[
    "awards",
    "baseballStats",
    "eventTypes",
    "fieldingStats",
    "gameStatus",
    "gameTypes",
    "hitTrajectories",
    "languages",
    "leagueLeaderTypes",
    "logicalEvents",
    "metrics",
    "pitchCodes",
    "pitchTypes",
    "platforms",
    "positions",
    "reviewReasons",
    "rosterTypes",
    "scheduleEventTypes",
    "situationCodes",
    "sky",
    "standingsTypes",
    "statGroups",
    "statTypes",
    "windDirection",
  ].map<EndpointDef>((m) => ({
    id: `meta-${m}`,
    category: "Meta",
    name: m,
    method: "GET",
    path: `/${m}`,
    description: `Metadata: ${m}`,
  })),
];

export const CATEGORIES = Array.from(
  new Set(ENDPOINTS.map((e) => e.category))
);
