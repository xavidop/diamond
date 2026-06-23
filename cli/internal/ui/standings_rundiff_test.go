package ui

import (
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func stdRec(teams ...mlb.Standing) mlb.StandingsRecord {
	var r mlb.StandingsRecord
	r.TeamRecords = teams
	return r
}

func team(name string, rs, ra int) mlb.Standing {
	var s mlb.Standing
	s.Team.Name = name
	s.RunsScored, s.RunsAllowed = rs, ra
	return s
}

func TestRunDiffRowsSortedByDiff(t *testing.T) {
	recs := []mlb.StandingsRecord{
		stdRec(team("A", 700, 650), team("B", 600, 700)), // +50, -100
		stdRec(team("C", 800, 600)),                      // +200
	}
	rows := runDiffRows(recs)
	if len(rows) != 3 {
		t.Fatalf("expected 3 teams, got %d", len(rows))
	}
	if rows[0].Name != "C" || rows[0].Diff != 200 {
		t.Fatalf("top should be C +200, got %+v", rows[0])
	}
	if rows[2].Name != "B" || rows[2].Diff != -100 {
		t.Fatalf("bottom should be B -100, got %+v", rows[2])
	}
}

func TestRenderRunDiffContent(t *testing.T) {
	m := StandingsModel{width: 100, records: []mlb.StandingsRecord{
		stdRec(team("Best Team", 800, 600), team("Worst Team", 600, 800)),
	}}
	out := ansiRe.ReplaceAllString(m.renderRunDiff(1.0), "")
	// best team appears before worst; diffs shown signed
	bi := strings.Index(out, "Best Team")
	wi := strings.Index(out, "Worst Team")
	if bi < 0 || wi < 0 || bi > wi {
		t.Fatalf("expected Best Team listed above Worst Team:\n%s", out)
	}
	if !strings.Contains(out, "+200") || !strings.Contains(out, "-200") {
		t.Fatalf("expected signed diffs +200 and -200:\n%s", out)
	}
}
