package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestStandingsSelectedTeamName(t *testing.T) {
	m := StandingsModel{records: []mlb.StandingsRecord{
		stdRec(team("New York Yankees", 0, 0), team("Boston Red Sox", 0, 0)),
	}}

	m.rowCursor = 1
	if got := m.selectedTeamName(); got != "Boston Red Sox" {
		t.Fatalf("division tab: selectedTeamName = %q, want Boston Red Sox", got)
	}

	// Run-diff tab selects from the run-diff ordering.
	m.tab = tabRunDiff
	m.rowCursor = 0
	if got := m.selectedTeamName(); got == "" {
		t.Fatalf("run-diff tab: selectedTeamName should not be empty")
	}
}

func TestStandingsEnterNavigatesToTeam(t *testing.T) {
	m := StandingsModel{records: []mlb.StandingsRecord{
		stdRec(team("New York Yankees", 0, 0), team("Boston Red Sox", 0, 0)),
	}}
	m.rowCursor = 1

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("enter produced no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok {
		t.Fatalf("expected NavigateMsg from enter, got %T", cmd())
	}
	if nav.View != ViewTeam || nav.Query != "Boston Red Sox" {
		t.Fatalf("nav = %+v, want View=ViewTeam Query=\"Boston Red Sox\"", nav)
	}
}
