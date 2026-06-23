package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestNewPlayerModelByIDStartsInDetail(t *testing.T) {
	m := NewPlayerModelByID(mlb.Sport{ID: 1}, 592450)
	if m.state != playerStateDetail {
		t.Fatalf("state = %v, want playerStateDetail", m.state)
	}
	if !m.fromDrill || m.detailID != 592450 {
		t.Fatalf("fromDrill=%v detailID=%d, want true/592450", m.fromDrill, m.detailID)
	}
	if m.Init() == nil {
		t.Fatalf("Init() should return a load command for a by-id model")
	}
}

func TestDrillPlayerEscGoesBack(t *testing.T) {
	m := NewPlayerModelByID(mlb.Sport{ID: 1}, 592450)
	m.loading = false // pretend detail loaded
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	if cmd == nil {
		t.Fatalf("esc on a drilled player should emit a command")
	}
	msg := cmd()
	nav, ok := msg.(NavigateMsg)
	if !ok || nav.View != ViewMenu {
		t.Fatalf("esc msg = %#v, want NavigateMsg{View: ViewMenu}", msg)
	}
}
