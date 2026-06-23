package diamondgpt

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func curSeason() string { return fmt.Sprintf("%d", time.Now().Year()) }

func seasonOr(s string) string {
	if strings.TrimSpace(s) == "" {
		return curSeason()
	}
	return s
}

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
type (
	noInput   struct{}
	dateInput struct {
		Date string `json:"date,omitempty" jsonschema_description:"Date YYYY-MM-DD; empty means today"`
	}
	seasonInput struct {
		Season string `json:"season,omitempty" jsonschema_description:"Season year e.g. 2025; empty means current"`
	}
	leadersInput struct {
		Group    string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
		Category string `json:"category,omitempty" jsonschema_description:"e.g. homeRuns (default), battingAverage, rbi, onBasePlusSlugging, earnedRunAverage, strikeouts, wins, saves, whip"`
		Season   string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
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
	teamStatsInput struct {
		TeamID int    `json:"teamId" jsonschema_description:"MLB team ID from mlb_teams"`
		Group  string `json:"group,omitempty" jsonschema_description:"'hitting' (default) or 'pitching'"`
		Season string `json:"season,omitempty" jsonschema_description:"Season year; empty means current"`
	}
	teamIDInput struct {
		TeamID int `json:"teamId" jsonschema_description:"MLB team ID from mlb_teams"`
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
	}
	gameInput struct {
		GamePk int `json:"gamePk" jsonschema_description:"Game primary key (gamePk) from mlb_schedule"`
	}
)

// defineTools registers every MLB endpoint as a tool, reusing mlb.Client and
// the mlb package's own types (serialized to JSON via jsonResult). toolOpts are
// applied to every tool; callers use this to pass ai.WithStrictSchema(false)
// for Anthropic, whose strict-schema (constrained-decoding) path stalls the
// model call for tens of seconds per tool schema (see New).
func defineTools(g *genkit.Genkit, c *mlb.Client, toolOpts ...ai.ToolOption) []ai.ToolRef {
	return []ai.ToolRef{
		genkit.DefineTool(g, "mlb_schedule",
			"List MLB games for a date (scores, status, start time). Empty date = today.",
			func(ctx *ai.ToolContext, in dateInput) (string, error) {
				date := in.Date
				if strings.TrimSpace(date) == "" {
					date = time.Now().Format("2006-01-02")
				}
				return jsonResult(c.Schedule(date, 1))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_standings",
			"MLB division standings (W-L, win%, games back) for a season.",
			func(ctx *ai.ToolContext, in seasonInput) (string, error) {
				return jsonResult(c.Standings(seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_wildcard_standings",
			"MLB wild card standings (the wild card race) for a season.",
			func(ctx *ai.ToolContext, in seasonInput) (string, error) {
				return jsonResult(c.WildCardStandings(seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_stat_leaders",
			"League leaders for a stat category (top players).",
			func(ctx *ai.ToolContext, in leadersInput) (string, error) {
				grp := in.Group
				if grp == "" {
					grp = "hitting"
				}
				cat := in.Category
				if cat == "" {
					cat = "homeRuns"
				}
				return jsonResult(c.Leaders(grp, cat, 1, seasonOr(in.Season)))
			}, toolOpts...),

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
				grp := in.Group
				if grp == "" {
					grp = "hitting"
				}
				return jsonResult(c.PersonGameLog(in.PlayerID, grp, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_player_splits",
			"Situational splits for a player (vs LHP/RHP, home/away, day/night, RISP, …).",
			func(ctx *ai.ToolContext, in playerLogInput) (string, error) {
				grp := in.Group
				if grp == "" {
					grp = "hitting"
				}
				return jsonResult(c.PersonSplits(in.PlayerID, grp, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_teams",
			"List all MLB teams with their IDs (use the IDs for roster/stats tools).",
			func(ctx *ai.ToolContext, _ noInput) (string, error) {
				return jsonResult(c.Teams(1))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_roster",
			"Active roster for a team by ID.",
			func(ctx *ai.ToolContext, in teamIDInput) (string, error) {
				return jsonResult(c.TeamRoster(in.TeamID))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_team_stats",
			"Season hitting or pitching stats for a team by ID.",
			func(ctx *ai.ToolContext, in teamStatsInput) (string, error) {
				grp := in.Group
				if grp == "" {
					grp = "hitting"
				}
				return jsonResult(c.TeamStats(in.TeamID, grp, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_awards",
			"Award recipients for an award id (ALMVP, NLCY, …) and season.",
			func(ctx *ai.ToolContext, in awardsInput) (string, error) {
				return jsonResult(c.AwardRecipients(in.AwardID, seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_postseason",
			"All postseason games (wild card → World Series) for a season.",
			func(ctx *ai.ToolContext, in seasonInput) (string, error) {
				return jsonResult(c.PostseasonSchedule(seasonOr(in.Season)))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_draft",
			"MLB draft rounds and picks for a year (empty = last year).",
			func(ctx *ai.ToolContext, in yearInput) (string, error) {
				yr := in.Year
				if strings.TrimSpace(yr) == "" {
					yr = fmt.Sprintf("%d", time.Now().Year()-1)
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

		genkit.DefineTool(g, "mlb_date_range_stats",
			"Leaders over a custom date window (for hot/cold streaks). Provide group, sortStat, startDate, endDate.",
			func(ctx *ai.ToolContext, in dateRangeInput) (string, error) {
				grp := in.Group
				if grp == "" {
					grp = "hitting"
				}
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
					end = time.Now().Format("2006-01-02")
				}
				start := in.StartDate
				if start == "" {
					start = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
				}
				return jsonResult(c.StatsByDateRange(grp, start, end, sortStat, order, 1))
			}, toolOpts...),

		genkit.DefineTool(g, "mlb_win_probability",
			"Win-probability time series for a game by gamePk.",
			func(ctx *ai.ToolContext, in gameInput) (string, error) {
				return jsonResult(c.WinProbability(in.GamePk))
			}, toolOpts...),
	}
}
