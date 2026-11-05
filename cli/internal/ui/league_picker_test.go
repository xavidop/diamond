package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func sportIndex(id int) int {
	for i, s := range mlb.AllSports {
		if s.ID == id {
			return i
		}
	}
	return -1
}

func keyMsg(s string) tea.KeyMsg {
	switch s {
	case "enter":
		return tea.KeyMsg{Type: tea.KeyEnter}
	case "esc":
		return tea.KeyMsg{Type: tea.KeyEsc}
	case "down":
		return tea.KeyMsg{Type: tea.KeyDown}
	case "left":
		return tea.KeyMsg{Type: tea.KeyLeft}
	}
	return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
}

func TestLeaguePickerSingleLeagueSportSelectsDirectly(t *testing.T) {
	m := NewLeaguePickerModel(mlb.AllSports[0])
	m.cursor = sportIndex(11) // Triple-A: one competition, no sub-league step
	m, cmd := m.Update(keyMsg("enter"))
	if m.inLeagues {
		t.Fatal("AAA should not open the league list")
	}
	if cmd == nil {
		t.Fatal("expected a SportChangedMsg command")
	}
	msg, ok := cmd().(SportChangedMsg)
	if !ok || msg.Sport.ID != 11 || !msg.League.IsAll() {
		t.Fatalf("got %+v, want SportChangedMsg{AAA, all leagues}", msg)
	}
}

func TestLeaguePickerWinterLeaguesOpensLeagueList(t *testing.T) {
	m := NewLeaguePickerModel(mlb.AllSports[0])
	m.cursor = sportIndex(17)
	m, cmd := m.Update(keyMsg("enter"))
	if !m.inLeagues || m.pending.ID != 17 {
		t.Fatalf("Winter Leagues should open the league list, got inLeagues=%v pending=%d", m.inLeagues, m.pending.ID)
	}
	if len(m.leagues) != len(mlb.WinterLeagues) {
		t.Fatalf("snapshot should render immediately, got %d leagues", len(m.leagues))
	}
	if cmd == nil {
		t.Fatal("expected a fetch command for the live league list")
	}
	if m.lcursor != 0 {
		t.Fatalf("cursor should start on ALL, got %d", m.lcursor)
	}

	// "ALL" → every winter league.
	all, cmd := m.Update(keyMsg("enter"))
	_ = all
	msg := cmd().(SportChangedMsg)
	if msg.Sport.ID != 17 || !msg.League.IsAll() {
		t.Fatalf("ALL should select sport 17 with no league filter, got %+v", msg)
	}

	// Down twice → second league in the snapshot (LVBP).
	m, _ = m.Update(keyMsg("down"))
	m, _ = m.Update(keyMsg("down"))
	_, cmd = m.Update(keyMsg("enter"))
	msg = cmd().(SportChangedMsg)
	if msg.Sport.ID != 17 || msg.League.ID != mlb.WinterLeagues[1].ID {
		t.Fatalf("got %+v, want league %d", msg, mlb.WinterLeagues[1].ID)
	}
}

func TestLeaguePickerLeagueListBackAndCancel(t *testing.T) {
	cur := mlb.AllSports[sportIndex(17)]
	lidom := mlb.WinterLeagues[0]
	m := NewLeaguePickerModel(cur, lidom)
	m.cursor = sportIndex(17)
	m, _ = m.Update(keyMsg("enter"))
	if m.lcursor != 1 {
		t.Fatalf("re-opening the current sport should preselect its league, cursor=%d", m.lcursor)
	}

	// ← goes back to the sport list without emitting anything.
	m, cmd := m.Update(keyMsg("left"))
	if m.inLeagues || cmd != nil {
		t.Fatal("left should return to the sport list silently")
	}

	// Esc cancels and restores the current sport + league filter.
	_, cmd = m.Update(keyMsg("esc"))
	msg := cmd().(SportChangedMsg)
	if msg.Sport.ID != 17 || msg.League.ID != lidom.ID {
		t.Fatalf("cancel should keep LIDOM, got %+v", msg)
	}
}

func TestLeaguePickerLeaguesLoadedKeepsSelection(t *testing.T) {
	m := NewLeaguePickerModel(mlb.AllSports[0])
	m.cursor = sportIndex(17)
	m, _ = m.Update(keyMsg("enter"))
	m, _ = m.Update(keyMsg("down")) // LIDOM (snapshot order)
	selected := m.leagues[0].ID

	// API returns a different order; the cursor must follow the selected league.
	api := []mlb.League{mlb.WinterLeagues[4], mlb.WinterLeagues[0], mlb.WinterLeagues[1]}
	m, _ = m.Update(leaguesLoadedMsg{sportID: 17, leagues: api})
	if m.loading {
		t.Fatal("loading should clear once leagues arrive")
	}
	if got := m.leagues[m.lcursor-1].ID; got != selected {
		t.Fatalf("selection moved: got %d, want %d", got, selected)
	}

	// A stale load for another sport is ignored.
	before := len(m.leagues)
	m, _ = m.Update(leaguesLoadedMsg{sportID: 23, leagues: nil})
	if len(m.leagues) != before {
		t.Fatal("leagues for a different sport must be ignored")
	}
}
