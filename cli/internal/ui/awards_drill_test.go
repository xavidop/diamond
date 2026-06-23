package ui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func aw(id int) mlb.AwardWinner {
	var w mlb.AwardWinner
	w.Player.ID = id
	return w
}

func awNamed(id int, name string) mlb.AwardWinner {
	var w mlb.AwardWinner
	w.Player.ID = id
	w.Player.NameFirstLast = name
	return w
}

func TestAwardsPlayerIDsRenderOrder(t *testing.T) {
	m := AwardsModel{winners: map[string][]mlb.AwardWinner{
		"ALMVP": {aw(1)},
		"NLMVP": {aw(2)},
		"WSMVP": {aw(3)},
	}}
	ids := m.playerIDs()
	// awardPairs order starts MVP (AL then NL); singles (WSMVP) come last.
	if len(ids) != 3 || ids[0] != 1 || ids[1] != 2 || ids[2] != 3 {
		t.Fatalf("ids = %v, want [1 2 3]", ids)
	}
}

func TestAwardsEnterDrillsSelected(t *testing.T) {
	m := AwardsModel{winners: map[string][]mlb.AwardWinner{
		"ALMVP": {aw(1)},
		"NLMVP": {aw(2)},
	}}
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}}) // cursor → 1 (NL MVP)
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatalf("no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok || nav.View != ViewPlayer || nav.PlayerID != 2 {
		t.Fatalf("nav = %#v, want ViewPlayer/2", cmd())
	}
}

// TestAwardsTallWindowFollowsCursor verifies that when the awards list exceeds
// 30 lines (e.g. Gold Glove with 9 winners per league), the view window follows
// the cursor so the last winner is visible even though it would be clipped at
// scroll=0.
func TestAwardsTallWindowFollowsCursor(t *testing.T) {
	// Build 9 AL and 9 NL Gold Glove winners — enough to push total lines > 30.
	alGG := []mlb.AwardWinner{
		awNamed(101, "AL Player One"),
		awNamed(102, "AL Player Two"),
		awNamed(103, "AL Player Three"),
		awNamed(104, "AL Player Four"),
		awNamed(105, "AL Player Five"),
		awNamed(106, "AL Player Six"),
		awNamed(107, "AL Player Seven"),
		awNamed(108, "AL Player Eight"),
		awNamed(109, "AL Player Nine"),
	}
	nlGG := []mlb.AwardWinner{
		awNamed(201, "NL Player One"),
		awNamed(202, "NL Player Two"),
		awNamed(203, "NL Player Three"),
		awNamed(204, "NL Player Four"),
		awNamed(205, "NL Player Five"),
		awNamed(206, "NL Player Six"),
		awNamed(207, "NL Player Seven"),
		awNamed(208, "NL Player Eight"),
		awNamed(209, "NL Player Nine"),
	}
	m := AwardsModel{
		winners: map[string][]mlb.AwardWinner{
			"ALGG": alGG,
			"NLGG": nlGG,
		},
		width: 100,
	}

	// Move cursor to the very last winner (last NL GG winner).
	ids := m.playerIDs()
	if len(ids) == 0 {
		t.Fatal("no player IDs")
	}
	m.cursor = len(ids) - 1
	lastName := nlGG[len(nlGG)-1].Player.NameFirstLast // "NL Player Nine"

	out := m.View()
	plain := ansiRe.ReplaceAllString(out, "")

	if !strings.Contains(plain, "▸") {
		t.Error("View() missing cursor marker ▸ — windowing not following cursor")
	}
	if !strings.Contains(plain, lastName) {
		t.Errorf("View() missing last winner %q — last winner scrolled off-screen", lastName)
	}
}
