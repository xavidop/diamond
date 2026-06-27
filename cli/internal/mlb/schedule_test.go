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
