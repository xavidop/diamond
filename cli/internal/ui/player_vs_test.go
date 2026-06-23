package ui

import (
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestRenderVsMatchupContent(t *testing.T) {
	var sp mlb.StatSplit
	sp.Stat = map[string]interface{}{
		"plateAppearances": 25, "atBats": 22, "hits": 7, "homeRuns": 2,
		"rbi": 5, "avg": ".318", "ops": "1.050",
	}
	out := ansiRe.ReplaceAllString(renderVsMatchup([]mlb.StatSplit{sp}, "Aaron Judge", "Gerrit Cole", false, 1.0), "")
	if !strings.Contains(out, "Gerrit Cole") {
		t.Fatalf("expected opponent name in matchup:\n%s", out)
	}
	if !strings.Contains(out, ".318") || !strings.Contains(out, "2") { // AVG + HR
		t.Fatalf("expected matchup stats rendered:\n%s", out)
	}
}

func sr(name, posCode string) mlb.SearchResult {
	var r mlb.SearchResult
	r.FullName = name
	r.PrimaryPosition.Code = posCode
	return r
}

func TestFilterVsOpponents(t *testing.T) {
	// vsPlayer is one-sided: a hitter only has data against pitchers, and a
	// pitcher only against batters. The opponent search must filter accordingly
	// so users can't pick a same-role opponent and land on "No head-to-head".
	results := []mlb.SearchResult{
		sr("Gerrit Cole", "1"),     // pitcher
		sr("Freddie Freeman", "3"), // 1B (batter)
		sr("Spencer Strider", "1"), // pitcher
		sr("Mookie Betts", "9"),    // RF (batter)
	}

	forHitter := filterVsOpponents(results, false) // hitter subject → keep pitchers
	if len(forHitter) != 2 {
		t.Fatalf("hitter subject should keep 2 pitchers, got %d: %+v", len(forHitter), forHitter)
	}
	for _, r := range forHitter {
		if r.PrimaryPosition.Code != "1" {
			t.Fatalf("hitter subject should keep only pitchers, got %s (code %s)", r.FullName, r.PrimaryPosition.Code)
		}
	}

	forPitcher := filterVsOpponents(results, true) // pitcher subject → keep batters
	if len(forPitcher) != 2 {
		t.Fatalf("pitcher subject should keep 2 batters, got %d: %+v", len(forPitcher), forPitcher)
	}
	for _, r := range forPitcher {
		if r.PrimaryPosition.Code == "1" {
			t.Fatalf("pitcher subject should exclude pitchers, got %s", r.FullName)
		}
	}
}
