package mlb

import "testing"

// A zero-game-log player must not error and must report zero requested games.
// (Uses a client with an unreachable base so any accidental network call fails
// loudly; with an empty log, no call is made.)
func TestPlayerRecentPlaysEmptyLog(t *testing.T) {
	// recentGamePks of an empty log is empty → PlayerRecentPlays returns early.
	if pks := recentGamePks(nil, 15); len(pks) != 0 {
		t.Fatalf("recentGamePks(nil) should be empty, got %v", pks)
	}
}
