package mlb

import (
	"testing"
	"time"
)

func spilloverGame(pk int, state string) Game {
	var g Game
	g.GamePk = pk
	g.Status.AbstractGameState = state
	return g
}

func spilloverGameAt(pk int, state string, start time.Time) Game {
	g := spilloverGame(pk, state)
	g.GameDate = start.Format(time.RFC3339)
	return g
}

func TestMergeRecentSpillover(t *testing.T) {
	now := time.Date(2026, 6, 27, 8, 0, 0, 0, time.UTC)
	today := []Game{
		spilloverGameAt(1, "Preview", now.Add(6*time.Hour)),
		spilloverGameAt(2, "Live", now.Add(-1*time.Hour)),
	}
	yesterday := []Game{
		spilloverGameAt(2, "Live", now.Add(-1*time.Hour)),   // already in today → not duplicated
		spilloverGameAt(3, "Live", now.Add(-15*time.Hour)),  // long/suspended but still live → included
		spilloverGameAt(4, "Final", now.Add(-3*time.Hour)),  // finished a few hours ago → included
		spilloverGameAt(5, "Final", now.Add(-20*time.Hour)), // finished a full slate ago → excluded
	}

	out := MergeRecentSpillover(today, yesterday, now)

	has := map[int]bool{}
	for _, g := range out {
		has[g.GamePk] = true
	}
	if len(out) != 4 {
		t.Fatalf("expected 4 games (2 today + live 3 + recent-final 4), got %d: %+v", len(out), out)
	}
	if !has[3] {
		t.Fatal("still-live spillover game 3 should be included")
	}
	if !has[4] {
		t.Fatal("recently-finished spillover game 4 should be included")
	}
	if has[5] {
		t.Fatal("stale final spillover game 5 must be excluded")
	}
}

// Adjacent-slate games that haven't started yet but begin soon (this evening's
// US slate for a viewer east of the US) must be included, while games further
// out are left for their own day.
func TestMergeRecentSpilloverUpcoming(t *testing.T) {
	now := time.Date(2026, 6, 27, 8, 0, 0, 0, time.UTC)
	yesterday := []Game{
		spilloverGameAt(10, "Preview", now.Add(1*time.Hour)), // imminent → included
		spilloverGameAt(11, "Preview", now.Add(5*time.Hour)), // within window → included
		spilloverGameAt(12, "Preview", now.Add(8*time.Hour)), // too far out → excluded
	}
	out := MergeRecentSpillover(nil, yesterday, now)
	has := map[int]bool{}
	for _, g := range out {
		has[g.GamePk] = true
	}
	if !has[10] {
		t.Fatal("imminent upcoming spillover game 10 should be included")
	}
	if !has[11] {
		t.Fatal("soon upcoming spillover game 11 should be included")
	}
	if has[12] {
		t.Fatal("far-future spillover game 12 must be excluded")
	}
}

func ids(games []Game) map[int]bool {
	out := map[int]bool{}
	for _, g := range games {
		out[g.GamePk] = true
	}
	return out
}

// GamesForDay shows the day's slate as-is and, only when the date is today,
// folds in currently-live games from the neighbouring days.
func TestGamesForDay(t *testing.T) {
	slate := []Game{
		spilloverGame(1, "Final"),
		spilloverGame(1, "Final"), // duplicate GamePk → deduped
		spilloverGame(2, "Preview"),
	}
	neighbors := []Game{
		spilloverGame(3, "Live"),    // active in another timezone → shown today
		spilloverGame(4, "Final"),   // finished on its own day → not folded in
		spilloverGame(5, "Preview"), // upcoming on its own day → not folded in
	}

	today := ids(GamesForDay(slate, neighbors, true))
	if !today[1] || !today[2] || !today[3] {
		t.Fatalf("today should include the slate (1,2) plus the live neighbor (3), got %+v", today)
	}
	if today[4] || today[5] {
		t.Fatal("finished/upcoming neighbors must not be folded into today")
	}

	notToday := ids(GamesForDay(slate, neighbors, false))
	if len(notToday) != 2 || !notToday[1] || !notToday[2] {
		t.Fatalf("a non-today date must show only its own slate (1,2), got %+v", notToday)
	}
}

// A Final game with an unparseable date falls back to the live-only rule.
func TestMergeRecentSpilloverBadDate(t *testing.T) {
	now := time.Date(2026, 6, 27, 8, 0, 0, 0, time.UTC)
	yesterday := []Game{
		spilloverGame(6, "Final"), // no GameDate → not recent → excluded
		spilloverGame(7, "Live"),  // live → included regardless of date
	}
	out := MergeRecentSpillover(nil, yesterday, now)
	has := map[int]bool{}
	for _, g := range out {
		has[g.GamePk] = true
	}
	if has[6] {
		t.Fatal("final game with no parseable date must be excluded")
	}
	if !has[7] {
		t.Fatal("live game must be included even without a date")
	}
}
