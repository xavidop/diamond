package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestDraftEnterDrillsSelectedPick(t *testing.T) {
	var r mlb.DraftRound
	var p0, p1 mlb.DraftPick
	p0.Person.ID = 7
	p1.Person.ID = 9
	r.Picks = []mlb.DraftPick{p0, p1}
	m := DraftModel{rounds: []mlb.DraftRound{r}}

	// move cursor down to the 2nd pick, then Enter
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	nav := navFromEnter(t, cmd) // helper from leaders_streaks_drill_test.go
	if nav.View != ViewPlayer || nav.PlayerID != 9 {
		t.Fatalf("nav = %+v, want ViewPlayer/9", nav)
	}
}
