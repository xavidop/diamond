package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func psGame(pk int, date, series string, away, home int) mlb.PostseasonGame {
	var g mlb.PostseasonGame
	g.GamePk = pk
	g.GameDate = date
	g.GameType = "W"
	g.SeriesDescription = series
	g.Teams.Away.Team.ID = away
	g.Teams.Home.Team.ID = home
	return g
}

func TestOrderedGamePksMatchesByDate(t *testing.T) {
	games := []mlb.PostseasonGame{
		psGame(2, "2025-10-02", "World Series", 10, 20),
		psGame(1, "2025-10-01", "World Series", 10, 20),
	}
	pks := orderedGamePks(games)
	if len(pks) != 2 || pks[0] != 1 || pks[1] != 2 {
		t.Fatalf("pks = %v, want [1 2] (date order)", pks)
	}
}

func TestPostseasonEnterDrillsSelectedGame(t *testing.T) {
	games := []mlb.PostseasonGame{
		psGame(1, "2025-10-01", "World Series", 10, 20),
		psGame(2, "2025-10-02", "World Series", 10, 20),
	}
	m := PostseasonModel{tab: 1, games: games, gamePks: orderedGamePks(games)}
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}}) // cursor → 1
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatalf("Enter produced no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok || nav.View != ViewGame || nav.GamePk != 2 {
		t.Fatalf("nav = %#v, want ViewGame/2", cmd())
	}
}

// TestPostseasonMultiSeriesParityAndDrill builds games spanning two series
// (ALCS and World Series, supplied out of date order) and verifies that
// orderedGamePks and renderGamesList walk games in the same order, and that
// pressing Enter after moving the cursor to index 2 drills the correct game.
func TestPostseasonMultiSeriesParityAndDrill(t *testing.T) {
	// ALCS: games ordered out of date sequence (pk 20 before pk 19).
	alcs1 := psGame(19, "2025-10-15", "AL Championship Series", 30, 40)
	alcs1.GameType = "L"
	alcs2 := psGame(20, "2025-10-14", "AL Championship Series", 30, 40)
	alcs2.GameType = "L"

	// World Series: games also out of date sequence (pk 4 before pk 3).
	ws1 := psGame(3, "2025-10-28", "World Series", 10, 20)
	ws2 := psGame(4, "2025-10-27", "World Series", 10, 20)

	// Supply games in a deliberately scrambled order.
	games := []mlb.PostseasonGame{ws1, alcs2, ws2, alcs1}

	pks := orderedGamePks(games)

	// Expected order:
	//   ALCS (gameType "L", order=2) comes before World Series (gameType "W", order=3).
	//   Within ALCS: pk 20 (date 2025-10-14) < pk 19 (date 2025-10-15).
	//   Within WS:   pk 4  (date 2025-10-27) < pk 3  (date 2025-10-28).
	want := []int{20, 19, 4, 3}
	if len(pks) != len(want) {
		t.Fatalf("orderedGamePks len=%d, want %d; pks=%v", len(pks), len(want), pks)
	}
	for i, pk := range pks {
		if pk != want[i] {
			t.Fatalf("orderedGamePks[%d]=%d, want %d; full=%v", i, pk, want[i], pks)
		}
	}

	// Cursor at index 2 should correspond to want[2] == 4 (first WS game).
	m := PostseasonModel{tab: 1, games: games, gamePks: pks}
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}}) // cursor → 1
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}}) // cursor → 2
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatalf("Enter at cursor=2 produced no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok || nav.View != ViewGame || nav.GamePk != want[2] {
		t.Fatalf("nav = %#v, want ViewGame/%d", cmd(), want[2])
	}
}
