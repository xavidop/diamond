package ui

import (
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func winterSport() mlb.Sport {
	return mlb.Sport{ID: 17, Code: "win", Name: "Winter Leagues", Abbreviation: "WIN"}
}

func TestBlockTitleFallsBackToLeagueWithoutDivision(t *testing.T) {
	var rec mlb.StandingsRecord
	rec.Division.Name = "American League East"
	if got := blockTitle(rec); got != "AL East" {
		t.Fatalf("MLB division title = %q, want AL East", got)
	}

	var lidom mlb.StandingsRecord
	lidom.League.ID, lidom.League.Name = 131, "Liga de Beisbol Dominicano"
	if got := blockTitle(lidom); got != "LIDOM · Liga de Beisbol Dominicano" {
		t.Fatalf("winter league title = %q", got)
	}

	var unknown mlb.StandingsRecord
	if got := blockTitle(unknown); got != "Standings" {
		t.Fatalf("empty record title = %q, want Standings", got)
	}
}

func TestScoresLeagueTagOnlyWhenUnfiltered(t *testing.T) {
	var g mlb.Game
	g.Teams.Home.Team.League.ID = 135
	g.Teams.Home.Team.League.Name = "Liga Venezuela Beisbol Profesional"

	m := NewScoresModel(winterSport())
	if tag := m.leagueTag(g); !strings.Contains(tag, "LVBP") {
		t.Fatalf("unfiltered winter leagues should tag games, got %q", tag)
	}
	if title := m.panelTitle(); title != "SCORES" {
		t.Fatalf("panelTitle = %q, want SCORES", title)
	}

	m.league = mlb.WinterLeagues[1] // LVBP picked → tag is redundant
	if tag := m.leagueTag(g); tag != "" {
		t.Fatalf("filtered view should not tag games, got %q", tag)
	}
	if title := m.panelTitle(); title != "SCORES · LVBP" {
		t.Fatalf("panelTitle = %q, want SCORES · LVBP", title)
	}

	mlbModel := NewScoresModel(mlb.AllSports[0])
	if tag := mlbModel.leagueTag(g); tag != "" {
		t.Fatalf("MLB should never tag games, got %q", tag)
	}
}

func TestSportLabelIncludesLeague(t *testing.T) {
	if got := sportLabel(winterSport(), mlb.League{}); got != "WIN" {
		t.Fatalf("sportLabel(all) = %q", got)
	}
	if got := sportLabel(winterSport(), mlb.WinterLeagues[0]); got != "WIN·LIDOM" {
		t.Fatalf("sportLabel(LIDOM) = %q", got)
	}
}

func TestStandingsTwoColumnSplitForWinterLeagues(t *testing.T) {
	m := NewStandingsModel(winterSport())
	m.width = 120
	m.loading = false
	for _, id := range []int{131, 135, 132} {
		var rec mlb.StandingsRecord
		rec.League.ID = id
		var s mlb.Standing
		s.Team.Name = "Team"
		rec.TeamRecords = []mlb.Standing{s}
		m.records = append(m.records, rec)
	}
	out := m.renderDivisionsView()
	for _, want := range []string{"LIDOM", "LVBP", "LMP"} {
		if !strings.Contains(out, want) {
			t.Fatalf("divisions view missing %s block:\n%s", want, out)
		}
	}
	// Three blocks over two columns: one line holds two league headers.
	twoOnOneLine := false
	for _, line := range strings.Split(out, "\n") {
		if strings.Contains(line, "LIDOM") && strings.Contains(line, "LMP") {
			twoOnOneLine = true
		}
	}
	if !twoOnOneLine {
		t.Fatalf("expected LIDOM and LMP side by side on a wide terminal:\n%s", out)
	}
}

func TestSportChangedDropsLeagueForSingleLeagueSports(t *testing.T) {
	a := navTestApp()
	a.notifySubs = map[int]bool{}
	a.notifyPrev = map[int][2]int{}
	model, _ := a.Update(SportChangedMsg{Sport: winterSport(), League: mlb.WinterLeagues[0]})
	a = model.(App)
	if a.league.ID != 131 || a.scores.league.ID != 131 || a.standings.league.ID != 131 || a.leaders.league.ID != 131 {
		t.Fatalf("league filter not propagated: app=%d scores=%d standings=%d leaders=%d", a.league.ID, a.scores.league.ID, a.standings.league.ID, a.leaders.league.ID)
	}
	model, _ = a.Update(SportChangedMsg{Sport: mlb.AllSports[0], League: mlb.WinterLeagues[0]})
	a = model.(App)
	if !a.league.IsAll() || !a.scores.league.IsAll() {
		t.Fatalf("MLB must clear any league filter, got %+v", a.league)
	}
}

func TestGamesBehindUsesLeagueFigureWithoutDivision(t *testing.T) {
	var div mlb.StandingsRecord
	div.Division.Name = "American League East"
	var row mlb.Standing
	row.GamesBack, row.LeagueGamesBack = "4.5", "9.0"
	if got := gamesBehind(div, row); got != "4.5" {
		t.Fatalf("division row should keep gamesBack, got %q", got)
	}

	var lidom mlb.StandingsRecord
	lidom.League.ID = 131
	row.GamesBack, row.LeagueGamesBack = "-4.0", "-" // leader: cutoff-relative vs behind-leader
	if got := gamesBehind(lidom, row); got != "-" {
		t.Fatalf("division-less leader should show the league figure, got %q", got)
	}
	row.GamesBack, row.LeagueGamesBack = "2.0", "6.0"
	if got := gamesBehind(lidom, row); got != "6.0" {
		t.Fatalf("division-less row should use leagueGamesBack, got %q", got)
	}
	row.LeagueGamesBack = ""
	if got := gamesBehind(lidom, row); got != "2.0" {
		t.Fatalf("missing leagueGamesBack should fall back to gamesBack, got %q", got)
	}
}
