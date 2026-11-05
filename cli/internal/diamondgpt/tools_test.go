package diamondgpt

import (
	"context"
	"testing"

	"github.com/firebase/genkit/go/genkit"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// The MCP server and DiamondGPT share defineTools; this pins the catalog so a
// renamed or dropped tool is caught, and that every name is unique (Genkit
// panics on duplicates only at registration time).
func TestDefineToolsCatalog(t *testing.T) {
	g := genkit.Init(context.Background())
	tools := defineTools(g, mlb.DefaultClient())

	want := []string{
		"mlb_sports", "mlb_leagues",
		"mlb_schedule", "mlb_standings", "mlb_wildcard_standings", "mlb_stat_leaders", "mlb_date_range_stats",
		"mlb_game", "mlb_game_content", "mlb_win_probability",
		"mlb_search_player", "mlb_player", "mlb_player_gamelog", "mlb_player_splits", "mlb_batter_vs_pitcher",
		"mlb_player_expected_stats", "mlb_player_sabermetrics", "mlb_player_percentiles", "mlb_player_fielding",
		"mlb_player_hot_cold_zones", "mlb_player_projections", "mlb_player_career_trail", "mlb_player_recent_plays",
		"mlb_teams", "mlb_team_roster", "mlb_team_stats", "mlb_team_leaders", "mlb_team_schedule",
		"mlb_team_coaches", "mlb_team_affiliates", "mlb_transactions",
		"mlb_awards", "mlb_postseason", "mlb_draft", "mlb_venues", "mlb_venue", "mlb_news",
	}
	if len(tools) != len(want) {
		t.Fatalf("defineTools registered %d tools, want %d", len(tools), len(want))
	}
	seen := map[string]bool{}
	for i, tr := range tools {
		name := tr.Name()
		if seen[name] {
			t.Fatalf("duplicate tool name %q", name)
		}
		seen[name] = true
		if name != want[i] {
			t.Fatalf("tool %d = %q, want %q", i, name, want[i])
		}
	}
}

func TestToolDefaults(t *testing.T) {
	if sportOr(0) != 1 || sportOr(-3) != 1 || sportOr(17) != 17 {
		t.Fatal("sportOr should default to MLB and pass through valid ids")
	}
	if groupOr("") != "hitting" || groupOr(" ") != "hitting" || groupOr("pitching") != "pitching" {
		t.Fatal("groupOr should default to hitting")
	}
}
