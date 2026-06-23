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

const historyLeaderCap = 10

type historyLoadedMsg struct {
	champ   string
	hr      []mlb.Leader
	era     []mlb.Leader
	records []mlb.StandingsRecord
}

type HistoryModel struct {
	season  int
	champ   string
	hr      []mlb.Leader
	era     []mlb.Leader
	records []mlb.StandingsRecord
	scroll  int
	cursor  int
	loading bool
	err     error
	client  *mlb.Client
	width   int
}

func NewHistoryModel() HistoryModel {
	return HistoryModel{season: time.Now().Year() - 1, client: mlb.DefaultClient(), loading: true}
}

// leaderIDs lists drillable player ids in render order: HR top-10 then ERA
// top-10 (capped to match leaderBlock's display).
func (m HistoryModel) leaderIDs() []int {
	var ids []int
	add := func(ls []mlb.Leader) {
		n := len(ls)
		if n > historyLeaderCap {
			n = historyLeaderCap
		}
		for i := 0; i < n; i++ {
			ids = append(ids, ls[i].Person.ID)
		}
	}
	add(m.hr)
	add(m.era)
	return ids
}

func (m HistoryModel) Init() tea.Cmd { return m.fetch() }

// wsChampion finds the World Series winner by counting game wins from scores
// (isWinner is a per-game flag, not the series winner — so we tally to 4).
func wsChampion(games []mlb.PostseasonGame) string {
	wins := map[int]int{}
	names := map[int]string{}
	for _, g := range games {
		if g.GameType != "W" {
			continue
		}
		a, h := g.Teams.Away, g.Teams.Home
		names[a.Team.ID], names[h.Team.ID] = a.Team.Name, h.Team.Name
		if g.Status.AbstractGameState != "Final" {
			continue
		}
		switch {
		case a.Score > h.Score:
			wins[a.Team.ID]++
		case h.Score > a.Score:
			wins[h.Team.ID]++
		}
	}
	bestID, best := 0, 0
	for id, n := range wins {
		if n > best {
			best, bestID = n, id
		}
	}
	if best >= 4 {
		return names[bestID]
	}
	return ""
}

func (m HistoryModel) fetch() tea.Cmd {
	season := fmt.Sprintf("%d", m.season)
	c := m.client
	return func() tea.Msg {
		var champ string
		var hr, era []mlb.Leader
		var recs []mlb.StandingsRecord
		var wg sync.WaitGroup
		wg.Add(4)
		go func() { defer wg.Done(); g, _ := c.PostseasonSchedule(season); champ = wsChampion(g) }()
		go func() { defer wg.Done(); hr, _ = c.Leaders("hitting", "homeRuns", 1, season) }()
		go func() { defer wg.Done(); era, _ = c.Leaders("pitching", "earnedRunAverage", 1, season) }()
		go func() { defer wg.Done(); recs, _ = c.Standings(season) }()
		wg.Wait()
		return historyLoadedMsg{champ: champ, hr: hr, era: era, records: recs}
	}
}

func (m HistoryModel) Update(msg tea.Msg) (HistoryModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case historyLoadedMsg:
		m.loading = false
		m.champ, m.hr, m.era, m.records = msg.champ, msg.hr, msg.era, msg.records
		m.scroll = 0
		m.cursor = 0
		return m, nil
	case ErrMsg:
		m.loading, m.err = false, msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "left", "h":
			if m.season > 1901 {
				m.season--
				m.loading = true
				m.cursor = 0
				return m, m.fetch()
			}
		case "right", "l":
			if m.season < time.Now().Year() {
				m.season++
				m.loading = true
				m.cursor = 0
				return m, m.fetch()
			}
		case "down", "j":
			if ids := m.leaderIDs(); m.cursor < len(ids)-1 {
				m.cursor++
			}
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "enter":
			ids := m.leaderIDs()
			if m.cursor < len(ids) && ids[m.cursor] > 0 {
				id := ids[m.cursor]
				return m, func() tea.Msg { return NavigateMsg{View: ViewPlayer, PlayerID: id} }
			}
		case "r":
			m.loading = true
			return m, m.fetch()
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

func (m HistoryModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}
	ts, te := headerColors()
	head := PanelHeader(fmt.Sprintf("HISTORY  %d", m.season), m.width) + "\n\n"
	help := HelpBar("◄/► season", "↑/↓ select", "Enter player", "r refresh", "esc back")

	if m.loading {
		return head + loadingView(fmt.Sprintf("Loading %d…", m.season))
	}

	var sb strings.Builder
	sb.WriteString(head)

	// World Series champion banner.
	if m.champ != "" {
		sb.WriteString("  🏆  " + gradientText("WORLD SERIES CHAMPIONS", ts, te) + "\n")
		sb.WriteString("      " + StyleAccent.Bold(true).Render(m.champ) + "\n\n")
	} else {
		sb.WriteString(StyleDim.Render("  World Series result not available.") + "\n\n")
	}

	// HR + ERA leaders side by side.
	hrN := len(m.hr)
	if hrN > historyLeaderCap {
		hrN = historyLeaderCap
	}
	hrSel, eraSel := -1, -1
	if m.cursor < hrN {
		hrSel = m.cursor
	} else {
		eraSel = m.cursor - hrN
	}
	hrBlock := leaderBlock("HR LEADERS", m.hr, "HR", ts, te, hrSel)
	eraBlock := leaderBlock("ERA LEADERS", m.era, "", ts, te, eraSel)
	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, hrBlock, "    ", eraBlock) + "\n\n")

	// Final standings, split by league.
	var al, nl []mlb.StandingsRecord
	for _, rec := range m.records {
		if strings.HasPrefix(rec.Division.Name, "National") {
			nl = append(nl, rec)
		} else {
			al = append(al, rec)
		}
	}

	// Wide terminals: AL | NL side by side (no scroll). Narrow: stacked + scroll.
	if m.width >= 84 {
		alBlock := historyStandings("AMERICAN LEAGUE", al, ts, te)
		nlBlock := historyStandings("NATIONAL LEAGUE", nl, ts, te)
		sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, alBlock, "    ", nlBlock))
		return sb.String() + "\n\n" + help
	}

	var lines []string
	lines = append(lines, strings.Split(historyStandings("AMERICAN LEAGUE", al, ts, te), "\n")...)
	lines = append(lines, "")
	lines = append(lines, strings.Split(historyStandings("NATIONAL LEAGUE", nl, ts, te), "\n")...)
	maxLines := 14
	start := m.scroll
	if start > len(lines)-1 {
		start = len(lines) - 1
	}
	if start < 0 {
		start = 0
	}
	visible := lines[start:]
	more := ""
	if len(visible) > maxLines {
		visible = visible[:maxLines]
		more = "\n  " + StyleDim.Render("↓ more — j to scroll")
	}
	sb.WriteString(strings.Join(visible, "\n") + more)

	return sb.String() + "\n\n" + help
}

// historyStandings renders one league's divisions as a fixed-width block.
func historyStandings(league string, recs []mlb.StandingsRecord, ts, te string) string {
	var b strings.Builder
	b.WriteString("  " + gradientText(league, ts, te) + "\n")
	for _, rec := range recs {
		name := rec.Division.Name
		if s := divisionShort[name]; s != "" {
			name = s
		}
		b.WriteString("  " + StyleHeader.Render(name) + "\n")
		for i, tr := range rec.TeamRecords {
			nameTxt := fmt.Sprintf("%-20s", truncate(tr.Team.Name, 20))
			wl := fmt.Sprintf("%3d-%-3d", tr.Wins, tr.Losses)
			pct := StyleDim.Render(tr.WinningPercentage)
			if i == 0 {
				b.WriteString("  " + StyleAccent.Render("★ "+nameTxt) + " " + wl + " " + pct + "\n")
			} else {
				b.WriteString("    " + StyleItemNormal.Render(nameTxt) + " " + wl + " " + pct + "\n")
			}
		}
		b.WriteString("\n")
	}
	return lipgloss.NewStyle().Width(40).Render(strings.TrimRight(b.String(), "\n"))
}

// leaderBlock renders a compact top-10 leaderboard with medal-colored ranks.
// sel is the selected row index within this block (0-based), or -1 for none.
func leaderBlock(title string, leaders []mlb.Leader, suffix, ts, te string, sel int) string {
	var b strings.Builder
	b.WriteString("  " + gradientText(title, ts, te) + "\n")
	n := len(leaders)
	if n > historyLeaderCap {
		n = historyLeaderCap
	}
	for i := 0; i < n; i++ {
		l := leaders[i]
		rank := rankStyle(l.Rank).Render(fmt.Sprintf("%2d", l.Rank))
		val := l.Value
		if suffix != "" {
			val += " " + suffix
		}
		name := truncate(l.Person.FullName, 20)
		row := fmt.Sprintf("  %s %-20s %s", rank, name, StyleAccent.Render(val))
		if i == sel {
			row = StyleItemSelected.Render(fmt.Sprintf("▸ %s %-20s %s", rank, name, val))
		}
		b.WriteString(row + "\n")
	}
	return lipgloss.NewStyle().Width(36).Render(strings.TrimRight(b.String(), "\n"))
}
