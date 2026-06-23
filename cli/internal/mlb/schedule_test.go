package mlb

import "testing"

func spilloverGame(pk int, state string) Game {
	var g Game
	g.GamePk = pk
	g.Status.AbstractGameState = state
	return g
}

func TestMergeLiveSpillover(t *testing.T) {
	today := []Game{spilloverGame(1, "Preview"), spilloverGame(2, "Live")}
	yesterday := []Game{
		spilloverGame(2, "Live"),  // already in today → not duplicated
		spilloverGame(3, "Live"),  // still live from yesterday → included
		spilloverGame(4, "Final"), // finished → excluded
	}

	out := MergeLiveSpillover(today, yesterday)

	if len(out) != 3 {
		t.Fatalf("expected 3 games (2 today + 1 live spillover), got %d: %+v", len(out), out)
	}
	has := map[int]bool{}
	for _, g := range out {
		has[g.GamePk] = true
	}
	if !has[3] {
		t.Fatal("expected still-live spillover game 3 to be included")
	}
	if has[4] {
		t.Fatal("final spillover game 4 must not be included")
	}
}
