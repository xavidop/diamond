package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestTeamTabsIncludeTxnsAndNews(t *testing.T) {
	want := []string{"Roster", "Hitting", "Pitching", "Depth", "Game Log", "Transactions", "News", "Farm", "Leaders", "Staff"}
	if len(teamTabNames) != len(want) {
		t.Fatalf("want %d tabs, got %d (%v)", len(want), len(teamTabNames), teamTabNames)
	}
	for i, n := range want {
		if teamTabNames[i] != n {
			t.Fatalf("tab %d = %q, want %q", i, teamTabNames[i], n)
		}
	}
}

func TestTeamNewsTabNoPanicWithoutTeam(t *testing.T) {
	// team is nil; tabbing onto Transactions/News must not deref it.
	m := TeamModel{state: teamStateDetail, tab: 4, teamGamesLoaded: true}
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab}) // -> Transactions (5)
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab}) // -> News (6); must not deref nil team
	if m.tab != 6 {
		t.Fatalf("want tab 6 (News), got %d", m.tab)
	}
}

func TestTeamSelectResetsCaches(t *testing.T) {
	m := TeamModel{
		state:          teamStateSearch,
		teams:          []mlb.Team{{ID: 147, Name: "New York Yankees"}},
		matches:        []int{0},
		cursor:         0,
		teamNewsLoaded: true,
		teamTxnsLoaded: true,
		teamGamesLoaded: true,
		newsCursor:     5,
	}
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if m.teamNewsLoaded || m.teamTxnsLoaded || m.teamGamesLoaded {
		t.Fatalf("loaded flags should reset on team select: news=%v txns=%v games=%v",
			m.teamNewsLoaded, m.teamTxnsLoaded, m.teamGamesLoaded)
	}
	if m.newsCursor != 0 {
		t.Fatalf("newsCursor should reset to 0, got %d", m.newsCursor)
	}
	if m.tab != 0 {
		t.Fatalf("tab should be 0, got %d", m.tab)
	}
}
