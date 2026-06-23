package ui

import (
	"fmt"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

var teamCmpHitting = []cmpStat{
	{"AVG", "avg", false}, {"OBP", "obp", false}, {"SLG", "slg", false}, {"OPS", "ops", false},
	{"R", "runs", false}, {"HR", "homeRuns", false}, {"H", "hits", false}, {"SB", "stolenBases", false},
}
var teamCmpPitching = []cmpStat{
	{"ERA", "era", true}, {"WHIP", "whip", true}, {"K", "strikeOuts", false},
	{"SV", "saves", false}, {"W", "wins", false}, {"SHO", "shutouts", false},
}

type teamCmpEntry struct {
	team     mlb.Team
	hitting  map[string]interface{}
	pitching map[string]interface{}
}

type teamCompareTeamsMsg struct{ teams []mlb.Team }
type teamCompareStatsMsg struct{ entry teamCmpEntry }

type TeamCompareModel struct {
	sport       mlb.Sport
	search      SearchInput
	teams       []mlb.Team
	matches     []int
	matchCursor int
	selected    []teamCmpEntry
	group       string
	loading     bool
	err         error
	client      *mlb.Client
	width       int
}

func NewTeamCompareModel(sport mlb.Sport) TeamCompareModel {
	return TeamCompareModel{
		sport:  sport,
		search: NewSearchInput("Filter teams to add…"),
		group:  "hitting",
		client: mlb.DefaultClient(),
	}
}

func (m TeamCompareModel) Init() tea.Cmd {
	c, sport := m.client, m.sport
	return func() tea.Msg {
		teams, err := c.Teams(sport.ID)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return teamCompareTeamsMsg{teams: teams}
	}
}

func (m *TeamCompareModel) updateMatches() {
	names := make([]string, len(m.teams))
	for i, t := range m.teams {
		names[i] = t.Name
	}
	m.matches = Filter(names, m.search.Value())
}

func (m TeamCompareModel) addTeam(t mlb.Team) tea.Cmd {
	c := m.client
	season := fmt.Sprintf("%d", time.Now().Year())
	return func() tea.Msg {
		var h, p map[string]interface{}
		var wg sync.WaitGroup
		wg.Add(2)
		go func() { defer wg.Done(); h, _ = c.TeamStats(t.ID, "hitting", season) }()
		go func() { defer wg.Done(); p, _ = c.TeamStats(t.ID, "pitching", season) }()
		wg.Wait()
		return teamCompareStatsMsg{entry: teamCmpEntry{team: t, hitting: h, pitching: p}}
	}
}

func (m TeamCompareModel) stats() []cmpStat {
	if m.group == "hitting" {
		return teamCmpHitting
	}
	return teamCmpPitching
}

func (m TeamCompareModel) Update(msg tea.Msg) (TeamCompareModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case teamCompareTeamsMsg:
		m.teams = msg.teams
		m.updateMatches()
		return m, nil
	case teamCompareStatsMsg:
		m.loading = false
		if len(m.selected) < 4 {
			m.selected = append(m.selected, msg.entry)
		}
		m.search.SetValue("")
		m.updateMatches()
		return m, nil
	case ErrMsg:
		m.loading, m.err = false, msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			if m.group == "hitting" {
				m.group = "pitching"
			} else {
				m.group = "hitting"
			}
			return m, nil
		case "ctrl+x":
			m.selected = nil
			return m, nil
		case "up":
			if m.matchCursor > 0 {
				m.matchCursor--
			}
			return m, nil
		case "down":
			if m.matchCursor < len(m.matches)-1 {
				m.matchCursor++
			}
			return m, nil
		case "enter":
			if len(m.matches) > 0 && len(m.selected) < 4 {
				m.loading = true
				return m, m.addTeam(m.teams[m.matches[m.matchCursor]])
			}
			return m, nil
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		default:
			var cmd tea.Cmd
			m.search, cmd = m.search.Update(msg)
			m.updateMatches()
			m.matchCursor = 0
			return m, cmd
		}
	}
	return m, nil
}

func (m TeamCompareModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("esc back")
	}

	var groupToggle string
	if m.group == "hitting" {
		groupToggle = StyleActiveTab.Render("Hitting") + StyleTab.Render("Pitching")
	} else {
		groupToggle = StyleTab.Render("Hitting") + StyleActiveTab.Render("Pitching")
	}

	var sb strings.Builder
	sb.WriteString(PanelHeader("COMPARE TEAMS", m.width) + "\n")
	sb.WriteString(groupToggle + StyleDim.Render(fmt.Sprintf("   %d/4 teams", len(m.selected))) + "\n\n")

	if len(m.selected) < 4 {
		sb.WriteString("  " + m.search.View() + "\n")
		if m.loading {
			sb.WriteString(loadingView("Loading team stats…") + "\n")
		}
		for i, idx := range m.matches {
			if i >= 6 {
				break
			}
			t := m.teams[idx]
			if i == m.matchCursor {
				sb.WriteString("  " + StyleAccent.Bold(true).Render("▸ "+t.Name) + "\n")
			} else {
				sb.WriteString("    " + StyleItemNormal.Render(t.Name) + "\n")
			}
		}
		sb.WriteString("\n")
	}

	if len(m.selected) == 0 {
		sb.WriteString(StyleDim.Render("  Add teams to compare their season stats.") + "\n")
		return sb.String() + "\n" + HelpBar("type to filter", "↑/↓ Enter add", "Tab hit/pitch", "esc back")
	}

	sb.WriteString(m.renderTable())
	return sb.String() + "\n" + HelpBar("type to filter", "Enter add", "Tab hit/pitch", "ctrl+x clear", "esc back")
}

func (m TeamCompareModel) statMap(e teamCmpEntry) map[string]interface{} {
	if m.group == "hitting" {
		return e.hitting
	}
	return e.pitching
}

func (m TeamCompareModel) renderTable() string {
	colW := 11
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("  %-6s", ""))
	for i, e := range m.selected {
		abbr := e.team.Abbreviation
		if abbr == "" {
			abbr = truncate(e.team.Name, colW-1)
		}
		sb.WriteString(lipgloss.NewStyle().Width(colW).Align(lipgloss.Right).
			Foreground(comparePalette(i)).Bold(true).Render(abbr))
	}
	sb.WriteString("\n  " + StyleDim.Render(strings.Repeat("─", 6+colW*len(m.selected))) + "\n")

	for _, st := range m.stats() {
		best, bestVal := -1, 0.0
		for i, e := range m.selected {
			v := statFloat(m.statMap(e), st.key)
			if i == 0 || (st.lowerBetter && v < bestVal) || (!st.lowerBetter && v > bestVal) {
				best, bestVal = i, v
			}
		}
		sb.WriteString("  " + StyleHeader.Render(fmt.Sprintf("%-6s", st.label)))
		for i, e := range m.selected {
			val := statVal(m.statMap(e), st.key)
			cell := lipgloss.NewStyle().Width(colW).Align(lipgloss.Right)
			if i == best && len(m.selected) > 1 {
				sb.WriteString(cell.Foreground(colorGold).Bold(true).Render(val))
			} else {
				sb.WriteString(cell.Foreground(colorText).Render(val))
			}
		}
		sb.WriteString("\n")
	}
	return sb.String()
}
