package ui

import (
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func yearGroup(groupName string, seasons ...string) mlb.StatGroup {
	var g mlb.StatGroup
	g.Type.DisplayName = "yearByYear"
	g.Group.DisplayName = groupName
	for _, s := range seasons {
		var sp mlb.StatSplit
		sp.Season = s
		sp.Stat = map[string]interface{}{"homeRuns": 30, "avg": ".280"}
		g.Splits = append(g.Splits, sp)
	}
	return g
}

func TestParseYearByYear(t *testing.T) {
	var p mlb.Player
	p.Stats = []mlb.StatGroup{
		yearGroup("hitting", "2023", "2024"),
		yearGroup("pitching", "2024"),
		{}, // a season-type group is ignored (Type.DisplayName == "")
	}
	hit := ParseYearByYear(&p, "hitting")
	if len(hit) != 2 || hit[0].Season != "2023" || hit[1].Season != "2024" {
		t.Fatalf("hitting yearByYear should be [2023 2024], got %+v", hit)
	}
	pit := ParseYearByYear(&p, "pitching")
	if len(pit) != 1 || pit[0].Season != "2024" {
		t.Fatalf("pitching yearByYear should be [2024], got %+v", pit)
	}
}

func TestRenderPlayerYearsContent(t *testing.T) {
	var p mlb.Player
	p.Stats = []mlb.StatGroup{yearGroup("hitting", "2023", "2024")}
	out := ansiRe.ReplaceAllString(renderPlayerYears(&p, false, 1.0), "")
	if !strings.Contains(out, "2023") || !strings.Contains(out, "2024") {
		t.Fatalf("expected both seasons in output:\n%s", out)
	}
	if !strings.Contains(out, "30") { // homeRuns value from the fixture
		t.Fatalf("expected the HR value rendered:\n%s", out)
	}
}

// careerGroup builds a career-type StatGroup with a single split.
func careerGroup(groupName string) mlb.StatGroup {
	var g mlb.StatGroup
	g.Type.DisplayName = "career"
	g.Group.DisplayName = groupName
	var sp mlb.StatSplit
	sp.Stat = map[string]interface{}{"homeRuns": 250, "avg": ".270", "gamesPlayed": 1500}
	g.Splits = append(g.Splits, sp)
	return g
}

func TestRenderPlayerYearsCareerGuard(t *testing.T) {
	// Player WITH a career group — output should contain "CAR".
	var withCareer mlb.Player
	withCareer.Stats = []mlb.StatGroup{
		yearGroup("hitting", "2023", "2024"),
		careerGroup("hitting"),
	}
	outWith := ansiRe.ReplaceAllString(renderPlayerYears(&withCareer, false, 1.0), "")
	if !strings.Contains(outWith, "CAR") {
		t.Fatalf("expected 'CAR' career row for player with career stats:\n%s", outWith)
	}

	// Player WITHOUT a career group — output must NOT contain "CAR".
	var withoutCareer mlb.Player
	withoutCareer.Stats = []mlb.StatGroup{
		yearGroup("hitting", "2023", "2024"),
	}
	outWithout := ansiRe.ReplaceAllString(renderPlayerYears(&withoutCareer, false, 1.0), "")
	if strings.Contains(outWithout, "CAR") {
		t.Fatalf("expected no 'CAR' career row for player without career stats:\n%s", outWithout)
	}
}
