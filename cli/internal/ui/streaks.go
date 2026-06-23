package ui

import (
	"fmt"
	"math"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// streakSort defines a sortable stat: id is the API sortStat param, key is the
// short key in the returned stat object, desc=true means higher is hotter.
type streakSort struct {
	id, label, key string
	desc           bool
}

var hittingStreakSorts = []streakSort{
	{"homeRuns", "HR", "homeRuns", true},
	{"battingAverage", "AVG", "avg", true},
	{"onBasePlusSlugging", "OPS", "ops", true},
	{"hits", "H", "hits", true},
	{"runsBattedIn", "RBI", "rbi", true},
	{"stolenBases", "SB", "stolenBases", true},
}

var pitchingStreakSorts = []streakSort{
	{"earnedRunAverage", "ERA", "era", false},
	{"strikeOuts", "K", "strikeOuts", true},
	{"wins", "W", "wins", true},
	{"saves", "SV", "saves", true},
	{"walksAndHitsPerInningPitched", "WHIP", "whip", false},
}

type streaksLoadedMsg struct{ splits []mlb.StreakSplit }

type StreaksModel struct {
	sport    mlb.Sport
	group    string
	window   int // rolling window in days: 7/14/30
	sortIdx  int
	splits   []mlb.StreakSplit
	cursor   int
	loadedAt int
	loading  bool
	err      error
	client   *mlb.Client
	width    int
}

func NewStreaksModel(sport mlb.Sport) StreaksModel {
	return StreaksModel{sport: sport, group: "hitting", window: 7, client: mlb.DefaultClient(), loading: true}
}

func (m StreaksModel) sorts() []streakSort {
	if m.group == "hitting" {
		return hittingStreakSorts
	}
	return pitchingStreakSorts
}

func (m StreaksModel) Init() tea.Cmd { return m.fetch() }

func (m StreaksModel) fetch() tea.Cmd {
	s := m.sorts()[m.sortIdx]
	order := "asc"
	if s.desc {
		order = "desc"
	}
	end := time.Now()
	start := end.AddDate(0, 0, -(m.window - 1))
	group, sortID, sportID := m.group, s.id, m.sport.ID
	es, ss := end.Format("2006-01-02"), start.Format("2006-01-02")
	c := m.client
	return func() tea.Msg {
		sp, err := c.StatsByDateRange(group, ss, es, sortID, order, sportID)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return streaksLoadedMsg{splits: sp}
	}
}

func (m StreaksModel) Update(msg tea.Msg) (StreaksModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case streaksLoadedMsg:
		m.loading, m.splits, m.cursor, m.loadedAt = false, msg.splits, 0, animFrame
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
			m.sortIdx, m.loading = 0, true
			return m, m.fetch()
		case "left", "h":
			n := len(m.sorts())
			m.sortIdx = (m.sortIdx - 1 + n) % n
			m.loading = true
			return m, m.fetch()
		case "right", "l":
			m.sortIdx = (m.sortIdx + 1) % len(m.sorts())
			m.loading = true
			return m, m.fetch()
		case "w":
			switch m.window {
			case 7:
				m.window = 14
			case 14:
				m.window = 30
			default:
				m.window = 7
			}
			m.loading = true
			return m, m.fetch()
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.splits)-1 {
				m.cursor++
			}
		case "enter":
			if m.cursor < len(m.splits) {
				if id := m.splits[m.cursor].Player.ID; id > 0 {
					return m, func() tea.Msg { return NavigateMsg{View: ViewPlayer, PlayerID: id} }
				}
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

func (m StreaksModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}

	sort := m.sorts()[m.sortIdx]
	hotIcon := lipgloss.NewStyle().Foreground(colorRed).Render("▲ hottest")
	if !sort.desc {
		hotIcon = StyleCyan.Render("▼ lowest")
	}

	panelHdr := PanelHeader("STREAKS", m.width)
	var groupToggle string
	if m.group == "hitting" {
		groupToggle = StyleActiveTab.Render("Hitting") + StyleTab.Render("Pitching")
	} else {
		groupToggle = StyleTab.Render("Hitting") + StyleActiveTab.Render("Pitching")
	}
	sub := fmt.Sprintf("  last %s  ·  by %s  %s",
		StyleAccent.Bold(true).Render(fmt.Sprintf("%d days", m.window)),
		StyleHeader.Render(sort.label), hotIcon)

	catRow := "  "
	for i, s := range m.sorts() {
		if i == m.sortIdx {
			catRow += StyleAccent.Bold(true).Render("▌"+s.label) + " "
		} else {
			catRow += StyleDim.Render(s.label) + " "
		}
	}

	head := panelHdr + "\n" + groupToggle + "\n" + sub + "\n" + catRow + "\n\n"
	help := HelpBar("Tab hit/pitch", "←/→ stat", "w window", "↑/↓ navigate", "Enter player", "r refresh", "esc back")

	if m.loading {
		return head + loadingView("Loading streaks…")
	}
	if len(m.splits) == 0 {
		return head + StyleDim.Render("  No data for this window.") + "\n\n" + help
	}

	// Bar scaling: rank 1 (first row) is hottest → fullest bar.
	maxV := math.Inf(-1)
	minV := math.Inf(1)
	vals := make([]float64, len(m.splits))
	for i, sp := range m.splits {
		v := statFloat(sp.Stat, sort.key)
		vals[i] = v
		if v > maxV {
			maxV = v
		}
		if v < minV {
			minV = v
		}
	}
	rng := maxV - minV

	barW := 24
	if m.width > 0 {
		barW = m.width - 48
		if barW < 12 {
			barW = 12
		}
		if barW > 32 {
			barW = 32
		}
	}

	var sb strings.Builder
	sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %2s  %-22s %-12s %6s", "#", "PLAYER", "TEAM", sort.label)) + "\n")
	sb.WriteString(StyleDim.Render("  "+strings.Repeat("─", 44+barW)) + "\n")
	for i, sp := range m.splits {
		frac := 1.0
		if rng > 0 {
			if sort.desc {
				frac = (vals[i] - minV) / rng
			} else {
				frac = (maxV - vals[i]) / rng
			}
			frac = 0.12 + 0.88*frac
		}
		frac *= animProgress(m.loadedAt+i/2, 6)
		rank := i + 1
		var barColor lipgloss.TerminalColor = colorBlue
		if rank <= 3 {
			barColor = rankColor(rank)
		}
		bar := RenderBar(frac, barW, barColor)
		rankCol := rankStyle(rank).Render(fmt.Sprintf("%2d", rank))
		name := fmt.Sprintf("%-22s", truncate(sp.Player.FullName, 22))
		team := fmt.Sprintf("%-12s", truncate(sp.Team.Name, 12))
		val := StyleAccent.Bold(true).Render(fmt.Sprintf("%6s", statVal(sp.Stat, sort.key)))
		pointer := "  "
		if i == m.cursor {
			pointer = StyleAccent.Bold(true).Render("▸ ")
			name = StyleAccent.Bold(true).Render(name)
		} else {
			name = StyleItemNormal.Render(name)
		}
		sb.WriteString(pointer + rankCol + "  " + name + " " + StyleDim.Render(team) + " " + val + "  " + bar + "\n")
	}

	return head + sb.String() + "\n" + help
}
