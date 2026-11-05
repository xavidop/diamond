package mlb

import "testing"

func leagueGame(pk, homeLeague, awayLeague int) Game {
	var g Game
	g.GamePk = pk
	g.Teams.Home.Team.League.ID = homeLeague
	g.Teams.Away.Team.League.ID = awayLeague
	return g
}

func TestHasSubleagues(t *testing.T) {
	if !(Sport{ID: 17}).HasSubleagues() {
		t.Fatal("Winter Leagues should have sub-leagues")
	}
	if (Sport{ID: 1}).HasSubleagues() || (Sport{ID: 11}).HasSubleagues() {
		t.Fatal("MLB / AAA should not be treated as multi-league sports")
	}
}

func TestGameLeagueIDAndFilter(t *testing.T) {
	games := []Game{leagueGame(1, 131, 131), leagueGame(2, 135, 135), leagueGame(3, 0, 131), leagueGame(4, 0, 0)}

	if got := GameLeagueID(games[0]); got != 131 {
		t.Fatalf("GameLeagueID = %d, want 131", got)
	}
	if got := GameLeagueID(games[2]); got != 131 {
		t.Fatalf("GameLeagueID should fall back to the away league, got %d", got)
	}
	if got := GameLeagueID(games[3]); got != 0 {
		t.Fatalf("GameLeagueID with no hydration = %d, want 0", got)
	}

	if got := FilterGamesByLeague(games, 0); len(got) != 4 {
		t.Fatalf("leagueID 0 must keep every game, got %d", len(got))
	}
	got := FilterGamesByLeague(games, 131)
	if len(got) != 2 || got[0].GamePk != 1 || got[1].GamePk != 3 {
		t.Fatalf("filter 131 = %+v, want games 1 and 3", got)
	}
	if got := FilterGamesByLeague(games, 595); len(got) != 0 {
		t.Fatalf("filter 595 should be empty, got %d", len(got))
	}
}

func TestNormalizeAndMergeLeagues(t *testing.T) {
	api := []League{
		{ID: 119, Abbreviation: "AFL", Name: "Arizona Fall League"},
		{ID: 131, Abbreviation: "DWL", Name: "Liga de Beisbol Dominicano", NameShort: "LIDOM"},
		{ID: 131, Abbreviation: "DWL"}, // duplicate
		{ID: 0},                        // malformed
	}
	merged := MergeLeagues(api, 17)
	if len(merged) != len(WinterLeagues) {
		t.Fatalf("merged = %d leagues, want %d (API + snapshot back-fill)", len(merged), len(WinterLeagues))
	}
	if merged[0].ID != 119 || merged[1].ID != 131 {
		t.Fatalf("API order must win, got %d, %d", merged[0].ID, merged[1].ID)
	}
	if merged[1].Abbreviation != "LIDOM" {
		t.Fatalf("LIDOM abbreviation override not applied: %q", merged[1].Abbreviation)
	}
	seen := map[int]bool{}
	for _, l := range merged {
		if seen[l.ID] {
			t.Fatalf("duplicate league %d in merged list", l.ID)
		}
		seen[l.ID] = true
		if l.SportID != 17 || l.Abbreviation == "" || l.Name == "" {
			t.Fatalf("incomplete league %+v", l)
		}
	}

	// Defunct leagues the API still lists (active=false) are dropped.
	inactive := false
	withDefunct := MergeLeagues([]League{{ID: 436, Abbreviation: "ALPB"}, {ID: 999, Abbreviation: "OLD", Active: &inactive}}, 23)
	if len(withDefunct) != 1 || withDefunct[0].ID != 436 {
		t.Fatalf("inactive league should be dropped, got %+v", withDefunct)
	}

	// A sport without a snapshot keeps the API's abbreviation.
	ind := MergeLeagues([]League{{ID: 436, Abbreviation: "ALPB", Name: "Atlantic League"}}, 23)
	if len(ind) != 1 || ind[0].Abbreviation != "ALPB" || ind[0].SportID != 23 {
		t.Fatalf("independent league normalized wrong: %+v", ind)
	}

	// No API data → the snapshot alone.
	if got := MergeLeagues(nil, 17); len(got) != len(WinterLeagues) {
		t.Fatalf("snapshot fallback = %d, want %d", len(got), len(WinterLeagues))
	}
	if got := MergeLeagues(nil, 1); len(got) != 0 {
		t.Fatalf("MLB has no snapshot, got %d", len(got))
	}
}

func TestLeagueAbbr(t *testing.T) {
	if got := LeagueAbbr(WinterLeagues, 131, ""); got != "LIDOM" {
		t.Fatalf("LeagueAbbr(131) = %q", got)
	}
	if got := LeagueAbbr(nil, 135, "x"); got != "LVBP" {
		t.Fatalf("override fallback = %q, want LVBP", got)
	}
	if got := LeagueAbbr(nil, 999, "Mystery League"); got != "Mystery League" {
		t.Fatalf("name fallback = %q", got)
	}
	if got := LeagueAbbr(WinterLeagues, 0, "x"); got != "" {
		t.Fatalf("league 0 should have no tag, got %q", got)
	}
	g := leagueGame(1, 132, 132)
	g.Teams.Home.Team.League.Name = "Liga Mexicana del Pacifico"
	if got := GameLeagueAbbr(nil, g); got != "LMP" {
		t.Fatalf("GameLeagueAbbr = %q, want LMP", got)
	}
}

func TestFindSportAndLeague(t *testing.T) {
	for _, q := range []string{"win", "WIN", "Winter Leagues", "17"} {
		s, ok := FindSport(q)
		if !ok || s.ID != 17 {
			t.Fatalf("FindSport(%q) = %+v, %v; want Winter Leagues", q, s, ok)
		}
	}
	if _, ok := FindSport("nope"); ok {
		t.Fatal("unknown sport should not resolve")
	}
	if _, ok := FindSport(""); ok {
		t.Fatal("empty sport should not resolve")
	}

	for _, q := range []string{"lidom", "LIDOM", "Dominican", "131", "DWL"} {
		l, ok := FindLeague(WinterLeagues, q)
		if !ok || l.ID != 131 {
			t.Fatalf("FindLeague(%q) = %+v, %v; want LIDOM", q, l, ok)
		}
	}
	if _, ok := FindLeague(WinterLeagues, "NPB"); ok {
		t.Fatal("unknown league should not resolve")
	}
}
