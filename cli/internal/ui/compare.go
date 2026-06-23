package ui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type cmpStat struct {
	label, key  string
	lowerBetter bool
}

var cmpHitting = []cmpStat{
	{"AVG", "avg", false}, {"OBP", "obp", false}, {"SLG", "slg", false}, {"OPS", "ops", false},
	{"HR", "homeRuns", false}, {"RBI", "rbi", false}, {"H", "hits", false},
	{"R", "runs", false}, {"SB", "stolenBases", false},
}
var cmpPitching = []cmpStat{
	{"ERA", "era", true}, {"WHIP", "whip", true}, {"W", "wins", false}, {"SV", "saves", false},
	{"K", "strikeOuts", false}, {"IP", "inningsPitched", false},
}

// careerStat returns a player's career stat map for the given group.
func careerStat(p *mlb.Player, group string) map[string]interface{} {
	for _, sg := range p.Stats {
		if sg.Type.DisplayName == "career" && sg.Group.DisplayName == group && len(sg.Splits) > 0 {
			return sg.Splits[0].Stat
		}
	}
	return map[string]interface{}{}
}

type comparePlayerMsg struct{ player *mlb.Player }
type compareSearchMsg struct{ results []mlb.SearchResult }

type CompareModel struct {
	sport     mlb.Sport
	search    SearchInput
	results   []mlb.SearchResult
	resCursor int
	players   []*mlb.Player
	group     string
	loading   bool
	err       error
	client    *mlb.Client
	width     int
}

func NewCompareModel(sport mlb.Sport) CompareModel {
	return CompareModel{
		sport:  sport,
		search: NewSearchInput("Search a player to add…"),
		group:  "hitting",
		client: mlb.DefaultClient(),
	}
}

func (m CompareModel) Init() tea.Cmd { return nil }

func (m CompareModel) doSearch(q string) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		res, err := c.Search(q)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return compareSearchMsg{results: res}
	}
}

func (m CompareModel) addPlayer(id int) tea.Cmd {
	c := m.client
	season := fmt.Sprintf("%d", time.Now().Year())
	return func() tea.Msg {
		p, err := c.Person(id, season)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return comparePlayerMsg{player: p}
	}
}

func (m CompareModel) stats() []cmpStat {
	if m.group == "hitting" {
		return cmpHitting
	}
	return cmpPitching
}

func (m CompareModel) Update(msg tea.Msg) (CompareModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case compareSearchMsg:
		m.results, m.resCursor = msg.results, 0
		return m, nil
	case comparePlayerMsg:
		m.loading = false
		if len(m.players) < 4 {
			m.players = append(m.players, msg.player)
		}
		m.search.SetValue("")
		m.results = nil
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
			m.players = nil
			return m, nil
		case "up":
			if m.resCursor > 0 {
				m.resCursor--
			}
			return m, nil
		case "down":
			if m.resCursor < len(m.results)-1 {
				m.resCursor++
			}
			return m, nil
		case "enter":
			if len(m.results) > 0 && len(m.players) < 4 {
				m.loading = true
				return m, m.addPlayer(m.results[m.resCursor].ID)
			}
			return m, nil
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		default:
			var cmd tea.Cmd
			m.search, cmd = m.search.Update(msg)
			if q := m.search.Value(); len(q) >= 2 {
				return m, tea.Batch(cmd, m.doSearch(q))
			}
			m.results = nil
			return m, cmd
		}
	}
	return m, nil
}

func (m CompareModel) View() string {
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
	sb.WriteString(PanelHeader("COMPARE PLAYERS", m.width) + "\n")
	sb.WriteString(groupToggle + StyleDim.Render(fmt.Sprintf("   %d/4 players", len(m.players))) + "\n\n")

	// Search box + results (only when fewer than 4 players).
	if len(m.players) < 4 {
		sb.WriteString("  " + m.search.View() + "\n")
		if m.loading {
			sb.WriteString(loadingView("Loading player…") + "\n")
		}
		for i, r := range m.results {
			if i >= 6 {
				break
			}
			line := fmt.Sprintf("%s  %s", r.FullName, StyleDim.Render(""))
			if i == m.resCursor {
				sb.WriteString("  " + StyleAccent.Bold(true).Render("▸ "+line) + "\n")
			} else {
				sb.WriteString("    " + StyleItemNormal.Render(line) + "\n")
			}
		}
		sb.WriteString("\n")
	}

	if len(m.players) == 0 {
		sb.WriteString(StyleDim.Render("  Add players to compare them head-to-head.") + "\n")
		return sb.String() + "\n" + HelpBar("type to search", "↑/↓ Enter add", "Tab hit/pitch", "esc back")
	}

	sb.WriteString(m.renderTable())
	return sb.String() + "\n" + HelpBar("type to search", "Enter add", "Tab hit/pitch", "ctrl+x clear", "esc back")
}

func (m CompareModel) renderTable() string {
	colW := 12
	var sb strings.Builder

	// Header row: player names.
	sb.WriteString(fmt.Sprintf("  %-6s", ""))
	for i, p := range m.players {
		name := truncate(lastName(p.FullName), colW-1)
		sb.WriteString(lipgloss.NewStyle().Width(colW).Align(lipgloss.Right).
			Foreground(comparePalette(i)).Bold(true).Render(name))
	}
	sb.WriteString("\n  " + StyleDim.Render(strings.Repeat("─", 6+colW*len(m.players))) + "\n")

	for _, st := range m.stats() {
		// Determine best slot for highlight.
		best, bestVal := -1, 0.0
		for i, p := range m.players {
			v := statFloat(careerStat(p, m.group), st.key)
			if i == 0 || (st.lowerBetter && v < bestVal) || (!st.lowerBetter && v > bestVal) {
				best, bestVal = i, v
			}
		}
		sb.WriteString("  " + StyleHeader.Render(fmt.Sprintf("%-6s", st.label)))
		for i, p := range m.players {
			val := statVal(careerStat(p, m.group), st.key)
			cell := lipgloss.NewStyle().Width(colW).Align(lipgloss.Right)
			if i == best && len(m.players) > 1 {
				sb.WriteString(cell.Foreground(colorGold).Bold(true).Render(val))
			} else {
				sb.WriteString(cell.Foreground(colorText).Render(val))
			}
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

// comparePalette assigns a distinct color per compare slot.
func comparePalette(i int) lipgloss.TerminalColor {
	switch i {
	case 0:
		return colorGold
	case 1:
		return colorCyan
	case 2:
		return colorGreen
	default:
		return colorBlue
	}
}

func lastName(full string) string {
	parts := strings.Fields(full)
	if len(parts) == 0 {
		return full
	}
	return parts[len(parts)-1]
}
