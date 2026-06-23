package ui

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type leadersLoadedMsg struct{ leaders []mlb.Leader }

var hittingCats = []string{"homeRuns", "battingAverage", "rbi", "onBasePlusSlugging", "sluggingPercentage", "hits", "stolenBases"}
var hittingLabels = []string{"HR", "AVG", "RBI", "OPS", "SLG", "H", "SB"}
var pitchingCats = []string{"earnedRunAverage", "wins", "strikeouts", "saves", "whip", "inningsPitched"}
var pitchingLabels = []string{"ERA", "W", "K", "SV", "WHIP", "IP"}

type LeadersModel struct {
	sport     mlb.Sport
	group     string // "hitting" or "pitching"
	catIdx    int
	leaders   []mlb.Leader
	rowCursor int
	loading   bool
	loadedAt  int // animFrame when data arrived, for the bar cascade
	err       error
	client    *mlb.Client
	width     int
}

func NewLeadersModel(sport mlb.Sport) LeadersModel {
	return LeadersModel{sport: sport, group: "hitting", client: mlb.DefaultClient(), loading: true}
}

func (m LeadersModel) Init() tea.Cmd { return m.fetch() }

func (m LeadersModel) cats() []string {
	if m.group == "hitting" {
		return hittingCats
	}
	return pitchingCats
}

func (m LeadersModel) labels() []string {
	if m.group == "hitting" {
		return hittingLabels
	}
	return pitchingLabels
}

func (m LeadersModel) fetch() tea.Cmd {
	cat := m.cats()[m.catIdx]
	group := m.group
	sport := m.sport
	season := fmt.Sprintf("%d", time.Now().Year())
	c := m.client
	return func() tea.Msg {
		leaders, err := c.Leaders(group, cat, sport.ID, season)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return leadersLoadedMsg{leaders: leaders}
	}
}

func (m LeadersModel) Update(msg tea.Msg) (LeadersModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case leadersLoadedMsg:
		m.loading = false
		m.leaders = msg.leaders
		m.rowCursor = 0
		m.loadedAt = animFrame
		return m, nil
	case ErrMsg:
		m.loading = false
		m.err = msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			if m.group == "hitting" {
				m.group = "pitching"
			} else {
				m.group = "hitting"
			}
			m.catIdx = 0
			m.rowCursor = 0
			m.loading = true
			return m, m.fetch()
		case "right", "l":
			if m.catIdx < len(m.cats())-1 {
				m.catIdx++
				m.rowCursor = 0
				m.loading = true
				return m, m.fetch()
			}
		case "left", "h":
			if m.catIdx > 0 {
				m.catIdx--
				m.rowCursor = 0
				m.loading = true
				return m, m.fetch()
			}
		case "up", "k":
			if m.rowCursor > 0 {
				m.rowCursor--
			}
		case "down", "j":
			if m.rowCursor < len(m.leaders)-1 {
				m.rowCursor++
			}
		case "enter":
			if m.rowCursor < len(m.leaders) {
				if id := m.leaders[m.rowCursor].Person.ID; id > 0 {
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

func (m LeadersModel) lowerIsBetter() bool {
	switch m.cats()[m.catIdx] {
	case "earnedRunAverage", "whip":
		return true
	}
	return false
}

func parseStatFloat(s string) float64 {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return f
}

func (m LeadersModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}

	panelHdr := PanelHeader("LEADERS", m.width)

	var groupToggle string
	if m.group == "hitting" {
		groupToggle = StyleActiveTab.Render("Hitting") + StyleTab.Render("Pitching")
	} else {
		groupToggle = StyleTab.Render("Hitting") + StyleActiveTab.Render("Pitching")
	}

	cats := m.labels()
	catRow := "  "
	for i, l := range cats {
		if i == m.catIdx {
			catRow += StyleAccent.Bold(true).Render("▌"+l) + " "
		} else {
			catRow += StyleDim.Render(l) + " "
		}
	}

	help := HelpBar("Tab hit/pitch", "←/→ category", "↑/↓ navigate", "Enter player", "r refresh", "esc back")
	head := panelHdr + "\n" + groupToggle + "\n" + catRow + "\n\n"

	if m.loading {
		return head + loadingView("Loading…")
	}
	if len(m.leaders) == 0 {
		return head + StyleDim.Render("  No leaders for this category.") + "\n\n" + help
	}

	label := m.labels()[m.catIdx]

	// Parse values to scale the bars; #1 always gets the fullest bar.
	vals := make([]float64, len(m.leaders))
	minV, maxV := math.Inf(1), math.Inf(-1)
	for i, l := range m.leaders {
		v := parseStatFloat(l.Value)
		vals[i] = v
		if v < minV {
			minV = v
		}
		if v > maxV {
			maxV = v
		}
	}
	rangeV := maxV - minV
	lower := m.lowerIsBetter()

	barW := 26
	if m.width > 0 {
		barW = m.width - 46
		if barW < 12 {
			barW = 12
		}
		if barW > 32 {
			barW = 32
		}
	}

	var sb strings.Builder
	sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %2s  %-22s %-4s %6s", "#", "PLAYER", "TM", label)) + "\n")
	sb.WriteString(StyleDim.Render("  "+strings.Repeat("─", 36+barW)) + "\n")

	for i, l := range m.leaders {
		frac := 1.0
		if rangeV > 0 {
			if lower {
				frac = (maxV - vals[i]) / rangeV
			} else {
				frac = (vals[i] - minV) / rangeV
			}
			frac = 0.12 + 0.88*frac // floor so the lowest entry still shows a stub
		}
		// Staggered fill-in: each row's bar grows slightly after the one above.
		frac *= animProgress(m.loadedAt+i/2, 6)
		var barColor lipgloss.TerminalColor = colorBlue
		if l.Rank <= 3 {
			barColor = rankColor(l.Rank)
		}
		bar := RenderBar(frac, barW, barColor)

		rankCol := rankStyle(l.Rank).Render(fmt.Sprintf("%2d", l.Rank))
		name := fmt.Sprintf("%-22s", truncate(l.Person.FullName, 22))
		team := fmt.Sprintf("%-4s", truncate(l.Team.Abbreviation, 4))
		val := StyleAccent.Bold(true).Render(fmt.Sprintf("%6s", l.Value))

		pointer := "  "
		if i == m.rowCursor {
			pointer = StyleAccent.Bold(true).Render("▸ ")
			name = StyleAccent.Bold(true).Render(name)
		} else {
			name = StyleItemNormal.Render(name)
		}
		sb.WriteString(pointer + rankCol + "  " + name + " " + StyleDim.Render(team) + " " + val + "  " + bar + "\n")
	}

	return head + sb.String() + "\n" + help
}
