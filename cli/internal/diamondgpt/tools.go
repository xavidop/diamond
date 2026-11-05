package diamondgpt

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"github.com/xavidop/diamond/cli/internal/espn"
	"github.com/xavidop/diamond/cli/internal/mlb"
	"github.com/xavidop/diamond/cli/internal/savant"
)

func curSeason() string { return fmt.Sprintf("%d", time.Now().Year()) }

func seasonOr(s string) string {
	if strings.TrimSpace(s) == "" {
		return curSeason()
	}
	return s
}

// sportOr defaults a sportId to MLB (1).
func sportOr(id int) int {
	if id <= 0 {
		return 1
	}
	return id
}

func groupOr(g string) string {
	if strings.TrimSpace(g) == "" {
		return "hitting"
	}
	return g
}

func todayISO() string { return time.Now().Format("2006-01-02") }

// jsonResult marshals an mlb value to a JSON string so tools return clean JSON
// to both the model and MCP clients (the MCP plugin passes string results
// through verbatim; non-strings get Go's %v formatting). Lets tools keep
// returning the mlb package's own types — we just serialize them here.
func jsonResult[T any](v T, err error) (string, error) {
	if err != nil {
		return "", err
	}
	b, e := json.Marshal(v)
	if e != nil {
		return "", e
	}
	return string(b), nil
}

// Tool inputs. These small structs are the parameter schemas Genkit needs (the
// model fills them); tool OUTPUTS reuse the mlb package types directly.
// Optional fields carry ,omitempty so they are not marked "required" in the
// generated tool schema (callers/models may leave them out; defaults apply).
//
// sportId / leagueId follow the Stats API: a sport is a level (1 = MLB,
// 11 = Triple-A, 17 = Winter Leagues, …) and a league sits under it (103 = AL,
// 131 = LIDOM, 135 = LVBP, …). Use mlb_sports / mlb_leagues to discover them.
type (
	noInput       struct{}
	scheduleInput struct {
		Date     string `json:"date,omitempty" jsonschema_description:"Date YYYY-MM-DD; empty means today"`
		SportID  int    `json:"sportId,omitempty" jsonschema_description:"Sport/level id: 1 = MLB (default), 11 = AAA, 12 = AA, 17 = Winter Leagues… (see mlb_sports)"`
		LeagueID int    `json:"leagueId,omitempty" jsonschema_description:"Narrow a multi-league sport to one league, e.g. 131 = LIDOM under sportId 17 (see mlb_leagues)"`
	}
	standingsInput struct {
		Season   string `json:"season,omitempty" jsonschema_description:"Season year e.g. 2025; empty means current"`
		SportID  int    `json:"sportId,omitempty" jsonschema_description:"Sport/level id: 1 = MLB (default), 11 = AAA, 17 = Winter Leagues… (see mlb_sports)"`
		LeagueID int    `json:"leagueId,omitempty" jsonschema_description:"One league only, e.g. 131 = LIDOM (see mlb_leagues); empty means every league under the sport"`
	}
	seasonInput struct {
		Season string `json:"season,omitempty" jsonschema_description:"Season year e.g. 2025; empty means current"`
	}
	sportInput struct {
		SportID int `json:"sportId,omitempty" jsonschema_description:"Sport/level id: 1 = MLB (default), 11 = AAA, 17 = Winter Leagues… (see mlb_sports)"`
	}
	leadersInput struct {
		Group    string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
		Category string `json:"category,omitempty" jsonschema_description:"e.g. homeRuns (default), battingAverage, rbi, onBasePlusSlugging, earnedRunAverage, strikeouts, wins, saves, whip"`
		Season   string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
		SportID  int    `json:"sportId,omitempty" jsonschema_description:"Sport/level id: 1 = MLB (default), 17 = Winter Leagues… (see mlb_sports)"`
		LeagueID int    `json:"leagueId,omitempty" jsonschema_description:"One league only, e.g. 131 = LIDOM (see mlb_leagues)"`
	}
	nameInput struct {
		Name string `json:"name" jsonschema_description:"Full or partial name"`
	}
	playerInput struct {
		PlayerID int    `json:"playerId" jsonschema_description:"MLB player ID from mlb_search_player"`
		Season   string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
	}
	playerLogInput struct {
		PlayerID int    `json:"playerId" jsonschema_description:"MLB player ID"`
		Group    string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
		Season   string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
	}
	playerGroupInput struct {
		PlayerID int    `json:"playerId" jsonschema_description:"MLB player ID"`
		Group    string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
	}
	matchupInput struct {
		PlayerID   int    `json:"playerId" jsonschema_description:"MLB player ID of the batter (or pitcher when group = 'pitching')"`
		OpponentID int    `json:"opponentId" jsonschema_description:"MLB player ID of the opposing pitcher (or batter)"`
		Group      string `json:"group,omitempty" jsonschema_description:"'hitting' (default: playerId is the batter) or 'pitching' (playerId is the pitcher)"`
	}
	recentPlaysInput struct {
		PlayerID int    `json:"playerId" jsonschema_description:"MLB player ID"`
		Role     string `json:"role,omitempty" jsonschema_description:"'hitting' (default: plays as batter) or 'pitching' (plays as pitcher)"`
		Games    int    `json:"games,omitempty" jsonschema_description:"How many recent games to scan (default 5, max 15)"`
	}
	percentilesInput struct {
		PlayerID int    `json:"playerId" jsonschema_description:"MLB player ID"`
		Kind     string `json:"kind,omitempty" jsonschema_description:"'batter' (default) or 'pitcher'"`
		Season   int    `json:"season,omitempty" jsonschema_description:"Season year; empty means the latest available"`
	}
	teamStatsInput struct {
		TeamID int    `json:"teamId" jsonschema_description:"MLB team ID from mlb_teams"`
		Group  string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
		Season string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
	}
	teamIDInput struct {
		TeamID int `json:"teamId" jsonschema_description:"MLB team ID from mlb_teams"`
	}
	teamSeasonInput struct {
		TeamID int    `json:"teamId" jsonschema_description:"MLB team ID from mlb_teams"`
		Season string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
	}
	transactionsInput struct {
		TeamID    int    `json:"teamId,omitempty" jsonschema_description:"Restrict to one team (MLB team ID); empty means league-wide"`
		StartDate string `json:"startDate,omitempty" jsonschema_description:"YYYY-MM-DD; empty means 7 days ago"`
		EndDate   string `json:"endDate,omitempty" jsonschema_description:"YYYY-MM-DD; empty means today"`
	}
	awardsInput struct {
		AwardID string `json:"awardId" jsonschema_description:"Award id, e.g. ALMVP, NLMVP, ALCY, NLCY, ALROY, NLROY, WSMVP"`
		Season  string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
	}
	yearInput struct {
		Year string `json:"year,omitempty" jsonschema_description:"Draft year, e.g. 2024; empty means last year"`
	}
	venueInput struct {
		VenueID int `json:"venueId" jsonschema_description:"Venue ID from mlb_venues"`
	}
	dateRangeInput struct {
		Group     string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
		SortStat  string `json:"sortStat,omitempty" jsonschema_description:"Stat to sort by, e.g. homeRuns (default), battingAverage, earnedRunAverage"`
		StartDate string `json:"startDate,omitempty" jsonschema_description:"YYYY-MM-DD; empty means 7 days ago"`
		EndDate   string `json:"endDate,omitempty" jsonschema_description:"YYYY-MM-DD; empty means today"`
		Order     string `json:"order,omitempty" jsonschema_description:"'desc' (default) or 'asc' for lower-is-better stats"`
		SportID   int    `json:"sportId,omitempty" jsonschema_description:"Sport/level id: 1 = MLB (default), 17 = Winter Leagues… (see mlb_sports)"`
	}
	gameInput struct {
		GamePk int `json:"gamePk" jsonschema_description:"Game primary key (gamePk) from mlb_schedule"`
	}
	newsInput struct {
		Limit int `json:"limit,omitempty" jsonschema_description:"How many headlines (default 10, max 30)"`
	}
)

// sportsCatalog is what mlb_sports returns: the levels Diamond knows plus, for
// multi-league sports, the leagues under them.
type sportsCatalog struct {
	Sports []sportEntry `json:"sports"`
}

type sportEntry struct {
	mlb.Sport
	HasSubleagues bool         `json:"hasSubleagues"`
	Leagues       []mlb.League `json:"leagues,omitempty"`
}

type teamLeadersResult struct {
	Hitting  []mlb.TeamLeaderCat `json:"hitting"`
	Pitching []mlb.TeamLeaderCat `json:"pitching"`
}

type recentPlaysResult struct {
	Plays []mlb.PlayEvent `json:"plays"`
	Meta  mlb.RecentMeta  `json:"meta"`
}

type postseasonResult struct {
	Season string               `json:"season"`
	Games  []mlb.PostseasonGame `json:"games"`
}

// defineTools registers every MLB endpoint as a tool, reusing mlb.Client and
// the mlb package's own types (serialized to JSON via jsonResult). toolOpts are
// applied to every tool; callers use this to pass ai.WithStrictSchema(false)
// for Anthropic, whose strict-schema (constrained-decoding) path stalls the
// model call for tens of seconds per tool schema (see New).
func defineTools(g *genkit.Genkit, c *mlb.Client, toolOpts ...ai.ToolOption) []ai.ToolRef {
	return []ai.ToolRef{
		// ── Discovery ────────────────────────────────────────────────────────
		genkit.DefineTool(g, "mlb_sports",
			"List the sports/levels Diamond covers (MLB, Triple-A, Winter Leagues, KBO…) with their sportId, and the leagues under multi-league sports (Winter Leagues → LIDOM, LVBP, LMP, LBPRC, AFL, ABL, CS). Use the ids with sportId/leagueId on other tools.",
			func(ctx *ai.ToolContext, _ noInput) (string, error) {
				cat := sportsCatalog{}
				for _, s := range mlb.AllSports {
					e := sportEntry{Sport: s, HasSubleagues: s.HasSubleagues()}
					if e.HasSubleagues {
						e.Leagues = mlb.StaticLeagues(s.ID)
					}
					cat.Sports = append(cat.Sports, e)
				}
				return jsonResult(cat, nil)
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_leagues",
			"Leagues under a sport (AL/NL for MLB; LIDOM, LVBP, LMP… for Winter Leagues) with their leagueId.",
			func(ctx *ai.ToolContext, in sportInput) (string, error) {
				return jsonResult(c.Leagues(sportOr(in.SportID)))
			}, toolOpts...),

		// ── Schedule & standings ─────────────────────────────────────────────
		genkit.DefineTool(g, "mlb_schedule",
			"List games for a date (scores, status, start time). Empty date = today. Defaults to MLB; pass sportId 17 for the winter leagues and leagueId to keep one league (e.g. 131 = LIDOM).",
			func(ctx *ai.ToolContext, in scheduleInput) (string, error) {
				date := in.Date
				if strings.TrimSpace(date) == "" {
					date = todayISO()
				}
				games, err := c.Schedule(date, sportOr(in.SportID))
				if err != nil {
					return "", err
				}
				return jsonResult(mlb.FilterGamesByLeague(games, in.LeagueID), nil)
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_standings",
			"Division standings (W-L, win%, games back) for a season. Defaults to MLB; sportId 17 gives every winter league, leagueId narrows to one (e.g. 131 = LIDOM). For division-less leagues read leagueGamesBack.",
			func(ctx *ai.ToolContext, in standingsInput) (string, error) {
				if in.LeagueID > 0 {
					return jsonResult(c.StandingsForLeague(in.LeagueID, seasonOr(in.Season)))
				}
				return jsonResult(c.Standings(sportOr(in.SportID), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_wildcard_standings",
			"MLB wild card standings (the wild card race) for a season.",
			func(ctx *ai.ToolContext, in seasonInput) (string, error) {
				return jsonResult(c.WildCardStandings(1, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_stat_leaders",
			"League leaders for a stat category (top players). Defaults to MLB; pass sportId / leagueId for other levels or one winter league.",
			func(ctx *ai.ToolContext, in leadersInput) (string, error) {
				cat := in.Category
				if cat == "" {
					cat = "homeRuns"
				}
				return jsonResult(c.LeadersInLeague(groupOr(in.Group), cat, sportOr(in.SportID), in.LeagueID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_date_range_stats",
			"Leaders over a custom date window (for hot/cold streaks). Provide group, sortStat, startDate, endDate.",
			func(ctx *ai.ToolContext, in dateRangeInput) (string, error) {
				order := in.Order
				if order == "" {
					order = "desc"
				}
				sortStat := in.SortStat
				if sortStat == "" {
					sortStat = "homeRuns"
				}
				end := in.EndDate
				if end == "" {
					end = todayISO()
				}
				start := in.StartDate
				if start == "" {
					start = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
				}
				return jsonResult(c.StatsByDateRange(groupOr(in.Group), start, end, sortStat, order, sportOr(in.SportID)))
			}, toolOpts...),

		// ── Games ────────────────────────────────────────────────────────────
		genkit.DefineTool(g, "mlb_game",
			"Live/final game detail by gamePk: linescore, boxscore batting & pitching lines, current play, weather, attendance, decisions.",
			func(ctx *ai.ToolContext, in gameInput) (string, error) {
				if in.GamePk <= 0 {
					return "", fmt.Errorf("gamePk is required (get it from mlb_schedule)")
				}
				return jsonResult(c.LiveFeed(in.GamePk))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_game_content",
			"Highlight clips (with video URLs) and the written recap for a game by gamePk.",
			func(ctx *ai.ToolContext, in gameInput) (string, error) {
				return jsonResult(c.Content(in.GamePk))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_win_probability",
			"Win-probability time series for a game by gamePk.",
			func(ctx *ai.ToolContext, in gameInput) (string, error) {
				return jsonResult(c.WinProbability(in.GamePk))
			}, toolOpts...),

		// ── Players ──────────────────────────────────────────────────────────
		genkit.DefineTool(g, "mlb_search_player",
			"Search active MLB players by name; returns player IDs for other tools.",
			func(ctx *ai.ToolContext, in nameInput) (string, error) {
				return jsonResult(c.Search(in.Name))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player",
			"Full bio + season/career stats for a player by ID (get the ID from mlb_search_player).",
			func(ctx *ai.ToolContext, in playerInput) (string, error) {
				return jsonResult(c.Person(in.PlayerID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_gamelog",
			"Per-game log for a player (group 'hitting' or 'pitching').",
			func(ctx *ai.ToolContext, in playerLogInput) (string, error) {
				return jsonResult(c.PersonGameLog(in.PlayerID, groupOr(in.Group), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_splits",
			"Situational splits for a player (vs LHP/RHP, home/away, day/night, RISP, …).",
			func(ctx *ai.ToolContext, in playerLogInput) (string, error) {
				return jsonResult(c.PersonSplits(in.PlayerID, groupOr(in.Group), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_batter_vs_pitcher",
			"Head-to-head matchup stats between a batter and a pitcher (career vs-player splits).",
			func(ctx *ai.ToolContext, in matchupInput) (string, error) {
				return jsonResult(c.PersonVsPlayer(in.PlayerID, in.OpponentID, groupOr(in.Group)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_expected_stats",
			"Statcast expected stats for a player/season: xBA, xSLG, xwOBA, exit velocity, barrel and hard-hit rates.",
			func(ctx *ai.ToolContext, in playerLogInput) (string, error) {
				return jsonResult(c.PlayerExpectedStats(in.PlayerID, groupOr(in.Group), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_sabermetrics",
			"Advanced value metrics for a player/season: WAR, wRC+, wOBA, FIP, xFIP, ERA-/wOBA-style indices.",
			func(ctx *ai.ToolContext, in playerLogInput) (string, error) {
				return jsonResult(c.PlayerSabermetrics(in.PlayerID, groupOr(in.Group), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_percentiles",
			"Baseball Savant percentile rankings for a player (sprint speed, xwOBA, barrel %, whiff %, arm strength…), 0-100 vs the league.",
			func(ctx *ai.ToolContext, in percentilesInput) (string, error) {
				return jsonResult(savant.Fetch(in.PlayerID, in.Kind, in.Season), nil)
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_fielding",
			"Season fielding lines by position for a player (innings, putouts, assists, errors, fielding %).",
			func(ctx *ai.ToolContext, in playerInput) (string, error) {
				return jsonResult(c.PlayerFielding(in.PlayerID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_hot_cold_zones",
			"Strike-zone heat map data for a player: per-zone batting average / exit velocity across the 13 zones.",
			func(ctx *ai.ToolContext, in playerLogInput) (string, error) {
				return jsonResult(c.PlayerHotColdZones(in.PlayerID, groupOr(in.Group), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_projections",
			"ZiPS rest-of-season projections for a player (group 'hitting' or 'pitching').",
			func(ctx *ai.ToolContext, in playerGroupInput) (string, error) {
				return jsonResult(c.PlayerProjections(in.PlayerID, groupOr(in.Group)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_career_trail",
			"Year-by-year career timeline across every level (Rookie → A → AA → AAA → MLB) for a player: the promotion trail.",
			func(ctx *ai.ToolContext, in playerGroupInput) (string, error) {
				return jsonResult(c.PlayerTrail(in.PlayerID, groupOr(in.Group)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_recent_plays",
			"Play-by-play events involving a player over their last N games (as batter or pitcher): result, pitch, exit velocity, distance.",
			func(ctx *ai.ToolContext, in recentPlaysInput) (string, error) {
				n := in.Games
				if n <= 0 {
					n = 5
				}
				if n > 15 {
					n = 15
				}
				plays, meta, err := c.PlayerRecentPlays(in.PlayerID, groupOr(in.Role), n)
				if err != nil {
					return "", err
				}
				return jsonResult(recentPlaysResult{Plays: plays, Meta: meta}, nil)
			}, toolOpts...),

		// ── Teams ────────────────────────────────────────────────────────────
		genkit.DefineTool(g, "mlb_teams",
			"List teams with their IDs (use the IDs for roster/stats tools). Defaults to MLB; pass sportId for other levels (17 = winter leagues, each team carries its league).",
			func(ctx *ai.ToolContext, in sportInput) (string, error) {
				return jsonResult(c.Teams(sportOr(in.SportID)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_roster",
			"Active roster for a team by ID.",
			func(ctx *ai.ToolContext, in teamIDInput) (string, error) {
				return jsonResult(c.TeamRoster(in.TeamID))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_stats",
			"Season hitting or pitching stats for a team by ID.",
			func(ctx *ai.ToolContext, in teamStatsInput) (string, error) {
				return jsonResult(c.TeamStats(in.TeamID, groupOr(in.Group), seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_leaders",
			"A team's own stat leaders by category (hitting and pitching) for a season.",
			func(ctx *ai.ToolContext, in teamSeasonInput) (string, error) {
				h, p, err := c.TeamLeaders(in.TeamID, seasonOr(in.Season))
				if err != nil {
					return "", err
				}
				return jsonResult(teamLeadersResult{Hitting: h, Pitching: p}, nil)
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_schedule",
			"A team's full season schedule with results (every game, one call).",
			func(ctx *ai.ToolContext, in teamSeasonInput) (string, error) {
				return jsonResult(c.TeamSchedule(in.TeamID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_coaches",
			"Coaching staff (manager, bench, hitting, pitching coaches…) for a team and season.",
			func(ctx *ai.ToolContext, in teamSeasonInput) (string, error) {
				return jsonResult(c.TeamCoaches(in.TeamID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_affiliates",
			"A club's minor-league affiliates (AAA → Rookie) for a season: the farm system.",
			func(ctx *ai.ToolContext, in teamSeasonInput) (string, error) {
				return jsonResult(c.TeamAffiliates(in.TeamID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_transactions",
			"Roster moves (trades, signings, call-ups, IL stints, DFAs) over a date range, league-wide or for one team. Defaults to the last 7 days.",
			func(ctx *ai.ToolContext, in transactionsInput) (string, error) {
				end := in.EndDate
				if end == "" {
					end = todayISO()
				}
				start := in.StartDate
				if start == "" {
					start = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
				}
				if in.TeamID > 0 {
					return jsonResult(c.TeamTransactions(in.TeamID, start, end))
				}
				return jsonResult(c.Transactions(start, end))
			}, toolOpts...),

		// ── Season context ───────────────────────────────────────────────────
		genkit.DefineTool(g, "mlb_awards",
			"Award recipients for an award id (ALMVP, NLCY, …) and season.",
			func(ctx *ai.ToolContext, in awardsInput) (string, error) {
				return jsonResult(c.AwardRecipients(in.AwardID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_postseason",
			"All postseason games (wild card → World Series) for a season. Empty season = the current postseason if it has started, else last year's.",
			func(ctx *ai.ToolContext, in seasonInput) (string, error) {
				if strings.TrimSpace(in.Season) == "" {
					season, games, err := c.CurrentPostseason(time.Now())
					if err != nil {
						return "", err
					}
					return jsonResult(postseasonResult{Season: season, Games: games}, nil)
				}
				games, err := c.PostseasonSchedule(in.Season)
				if err != nil {
					return "", err
				}
				return jsonResult(postseasonResult{Season: in.Season, Games: games}, nil)
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_draft",
			"MLB draft rounds and picks for a year (empty = last year).",
			func(ctx *ai.ToolContext, in yearInput) (string, error) {
				yr := in.Year
				if strings.TrimSpace(yr) == "" {
					yr = strconv.Itoa(time.Now().Year() - 1)
				}
				return jsonResult(c.Draft(yr))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_venues",
			"List MLB ballparks with their IDs.",
			func(ctx *ai.ToolContext, _ noInput) (string, error) {
				return jsonResult(c.Venues())
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_venue",
			"Detailed info (dimensions, capacity, location) for a ballpark by ID.",
			func(ctx *ai.ToolContext, in venueInput) (string, error) {
				return jsonResult(c.Venue(in.VenueID))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_news",
			"Latest MLB headlines from ESPN (title, summary, link, published time).",
			func(ctx *ai.ToolContext, in newsInput) (string, error) {
				n := in.Limit
				if n <= 0 {
					n = 10
				}
				if n > 30 {
					n = 30
				}
				return jsonResult(espn.DefaultClient().News("", n))
			}, toolOpts...),
	}
}
