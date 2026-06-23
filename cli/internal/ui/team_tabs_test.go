package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestTeamDetailBackTab(t *testing.T) {
	// teamGamesLoaded=true so wrapping onto the Game-Log tab doesn't try to
	// lazy-load via m.team (nil in this bare test model).
	m := TeamModel{state: teamStateDetail, tab: 0, teamGamesLoaded: true}
	// shift+tab from tab 0 wraps to the last tab (Game Log = index 4)
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyShiftTab})
	if m.tab != len(teamTabNames)-1 {
		t.Fatalf("shift+tab from 0 should wrap to %d, got %d", len(teamTabNames)-1, m.tab)
	}
	// shift+tab again steps back one
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyShiftTab})
	if m.tab != len(teamTabNames)-2 {
		t.Fatalf("shift+tab should step back to %d, got %d", len(teamTabNames)-2, m.tab)
	}
}
