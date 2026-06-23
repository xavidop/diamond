package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func navFromEnter(t *testing.T, cmd tea.Cmd) NavigateMsg {
	t.Helper()
	if cmd == nil {
		t.Fatalf("Enter produced no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok {
		t.Fatalf("Enter did not emit NavigateMsg")
	}
	return nav
}

func TestLeadersEnterDrillsToPlayer(t *testing.T) {
	m := LeadersModel{}
	var l1, l2 mlb.Leader
	l1.Person.ID = 100
	l2.Person.ID = 200
	m.leaders = []mlb.Leader{l1, l2}
	m.rowCursor = 1
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	nav := navFromEnter(t, cmd)
	if nav.View != ViewPlayer || nav.PlayerID != 200 {
		t.Fatalf("nav = %+v, want ViewPlayer/200", nav)
	}
}

func TestLeadersEnterZeroIDProducesNilCmd(t *testing.T) {
	m := LeadersModel{}
	var l mlb.Leader // Person.ID == 0
	m.leaders = []mlb.Leader{l}
	m.rowCursor = 0
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd != nil {
		t.Fatalf("Enter on zero-ID leader should produce no command, got %v", cmd)
	}
}

func TestStreaksEnterDrillsToPlayer(t *testing.T) {
	m := StreaksModel{}
	var s1, s2 mlb.StreakSplit
	s1.Player.ID = 11
	s2.Player.ID = 22
	m.splits = []mlb.StreakSplit{s1, s2}
	m.cursor = 0
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	nav := navFromEnter(t, cmd)
	if nav.View != ViewPlayer || nav.PlayerID != 11 {
		t.Fatalf("nav = %+v, want ViewPlayer/11", nav)
	}
}
