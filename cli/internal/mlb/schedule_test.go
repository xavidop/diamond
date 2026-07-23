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

func gameAt(pk int, state, detailed string, start time.Time) Game {
	g := spilloverGame(pk, state)
	g.Status.DetailedState = detailed
	g.GameDate = start.Format(time.RFC3339)
	return g
}

func ids(games []Game) map[int]bool {
	out := map[int]bool{}
	for _, g := range games {
		out[g.GamePk] = true
	}
	return out
}

// GamesForDay buckets live games onto today and finished/upcoming games onto
// the local day they started.
func TestGamesForDay(t *testing.T) {
	base := time.Date(2026, 6, 27, 12, 0, 0, 0, time.UTC)
	day := base.In(time.Local).Format("2006-01-02")
	next := base.Add(48 * time.Hour).In(time.Local).Format("2006-01-02")

	games := []Game{
		gameAt(10, "Final", "Final", base),                         // finished today → day
		gameAt(11, "Live", "In Progress", base.Add(-48*time.Hour)), // live, started 2 days ago → today
		gameAt(12, "Final", "Final", base.Add(48*time.Hour)),       // finished, started 2 days later → next
	}

	onDay := ids(GamesForDay(games, day, day))
	if !onDay[10] || !onDay[11] {
		t.Fatalf("expected games 10 (final today) and 11 (live→today) on %s, got %+v", day, onDay)
	}
	if onDay[12] {
		t.Fatal("a game that started two days later must not appear on today")
	}
	onNext := GamesForDay(games, next, day)
	if len(onNext) != 1 || onNext[0].GamePk != 12 {
		t.Fatalf("expected only game 12 on %s, got %+v", next, ids(onNext))
	}
}

// A postponed ghost must lose dedup to the real replayed entry, so the game
// shows only on the day it was actually played.
func TestGamesForDayGhost(t *testing.T) {
	base := time.Date(2026, 6, 27, 12, 0, 0, 0, time.UTC)
	day := base.In(time.Local).Format("2006-01-02")
	next := base.Add(48 * time.Hour).In(time.Local).Format("2006-01-02")

	ghost := gameAt(1, "Preview", "Postponed", base)            // buckets to day by start
	real := gameAt(1, "Final", "Final", base.Add(48*time.Hour)) // real replay → next

	if got := GamesForDay([]Game{ghost, real}, day, day); len(got) != 0 {
		t.Fatalf("postponed ghost must not appear on its original day, got %+v", ids(got))
	}
	if got := GamesForDay([]Game{ghost, real}, next, day); len(got) != 1 || got[0].GamePk != 1 {
		t.Fatalf("real replayed game should appear on its day, got %+v", ids(got))
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
