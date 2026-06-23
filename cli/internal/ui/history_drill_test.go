package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func ldr(id int) mlb.Leader {
	var l mlb.Leader
	l.Person.ID = id
	return l
}

func TestHistoryLeaderIDsCapAt10(t *testing.T) {
	// Build 11 HR leaders and 0 ERA; leaderIDs must cap at 10.
	hr := make([]mlb.Leader, 11)
	for i := range hr {
		hr[i].Person.ID = i + 1
	}
	m := HistoryModel{hr: hr}
	ids := m.leaderIDs()
	if len(ids) != 10 {
		t.Fatalf("leaderIDs returned %d ids, want 10", len(ids))
	}
}

func TestHistoryLeaderIDsOrder(t *testing.T) {
	m := HistoryModel{
		hr:  []mlb.Leader{ldr(1), ldr(2)},
		era: []mlb.Leader{ldr(3)},
	}
	ids := m.leaderIDs()
	if len(ids) != 3 || ids[0] != 1 || ids[1] != 2 || ids[2] != 3 {
		t.Fatalf("ids = %v, want [1 2 3] (HR then ERA)", ids)
	}
}

func TestHistoryEnterDrillsIntoEraLeader(t *testing.T) {
	m := HistoryModel{
		hr:  []mlb.Leader{ldr(1), ldr(2)},
		era: []mlb.Leader{ldr(3)},
	}
	// move cursor to the ERA leader (index 2), then Enter
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatalf("no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok || nav.View != ViewPlayer || nav.PlayerID != 3 {
		t.Fatalf("nav = %#v, want ViewPlayer/3", cmd())
	}
}
