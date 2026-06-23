package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestScoresNToggleNotify(t *testing.T) {
	var g mlb.Game
	g.GamePk = 99
	m := ScoresModel{games: []mlb.Game{g}}

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}})
	if cmd == nil {
		t.Fatal("pressing n on a game produced no command")
	}
	msg, ok := cmd().(ToggleNotifyMsg)
	if !ok {
		t.Fatalf("expected ToggleNotifyMsg, got %T", cmd())
	}
	if msg.GamePk != 99 {
		t.Fatalf("ToggleNotifyMsg.GamePk = %d, want 99", msg.GamePk)
	}
}
