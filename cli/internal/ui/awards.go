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

// Display groupings: AL/NL paired awards rendered side by side, plus singles.
var awardPairs = []struct {
	title, icon, al, nl string
}{
	{"MOST VALUABLE PLAYER", "🏆", "ALMVP", "NLMVP"},
	{"CY YOUNG", "🥇", "ALCY", "NLCY"},
	{"ROOKIE OF THE YEAR", "⭐", "ALROY", "NLROY"},
	{"SILVER SLUGGER", "🏏", "ALSS", "NLSS"},
	{"GOLD GLOVE", "🧤", "ALGG", "NLGG"},
}

var awardSingles = []struct {
	title, icon, id string
}{
	{"WORLD SERIES MVP", "💍", "WSMVP"},
	{"ALCS MVP", "🔶", "ALCSMVP"},
	{"NLCS MVP", "🔷", "NLCSMVP"},
}

type awardsLoadedMsg struct {
	winners map[string][]mlb.AwardWinner
}

var awardCategories = []struct {
	id    string
	label string
}{
	{"ALMVP", "AL Most Valuable Player"},
	{"NLMVP", "NL Most Valuable Player"},
	{"ALCY", "AL Cy Young Award"},
	{"NLCY", "NL Cy Young Award"},
	{"ALROY", "AL Rookie of the Year"},
	{"NLROY", "NL Rookie of the Year"},
	{"WSMVP", "World Series MVP"},
	{"ALCSMVP", "ALCS MVP"},
	{"NLCSMVP", "NLCS MVP"},
	{"ALSS", "AL Silver Slugger"},
	{"NLSS", "NL Silver Slugger"},
	{"ALGG", "AL Gold Glove"},
	{"NLGG", "NL Gold Glove"},
}

type AwardsModel struct {
	season  string
	loading bool
	winners map[string][]mlb.AwardWinner
	err     error
	client  *mlb.Client
	cursor  int
	width   int
}

// playerIDs lists award-winner player ids in render order: paired awards
// (AL then NL) for entries with data, then the singles section.
func (m AwardsModel) playerIDs() []int {
	var ids []int
	for _, p := range awardPairs {
		al, nl := m.winners[p.al], m.winners[p.nl]
		if len(al) == 0 && len(nl) == 0 {
			continue
		}
		for _, w := range al {
			ids = append(ids, w.Player.ID)
		}
		for _, w := range nl {
			ids = append(ids, w.Player.ID)
		}
	}
	for _, s := range awardSingles {
		if ws := m.winners[s.id]; len(ws) > 0 {
			ids = append(ids, ws[0].Player.ID)
		}
	}
	return ids
}

func NewAwardsModel() AwardsModel {
	// Default to the most recent completed season
	season := fmt.Sprintf("%d", time.Now().Year()-1)
	return AwardsModel{
		season:  season,
		loading: true,
		client:  mlb.DefaultClient(),
	}
}

func (m AwardsModel) Init() tea.Cmd {
	return m.fetch()
}

func (m AwardsModel) fetch() tea.Cmd {
	season := m.season
	c := m.client
	return func() tea.Msg {
		var mu sync.Mutex
		winners := make(map[string][]mlb.AwardWinner)
		var wg sync.WaitGroup
		for _, cat := range awardCategories {
			wg.Add(1)
			id := cat.id
			go func() {
				defer wg.Done()
				ws, err := c.AwardRecipients(id, season)
				if err != nil || len(ws) == 0 {
					return
				}
				mu.Lock()
				winners[id] = ws
				mu.Unlock()
			}()
		}
		wg.Wait()
		return awardsLoadedMsg{winners: winners}
	}
}

func (m AwardsModel) Update(msg tea.Msg) (AwardsModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case awardsLoadedMsg:
		m.loading = false
		m.err = nil
		m.winners = msg.winners
		m.cursor = 0
		return m, nil
	case ErrMsg:
		m.loading = false
		m.err = msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "j", "down":
			if ids := m.playerIDs(); m.cursor < len(ids)-1 {
				m.cursor++
			}
		case "k", "up":
			if m.cursor > 0 {
				m.cursor--
			}
		case "enter":
			ids := m.playerIDs()
			if m.cursor < len(ids) && ids[m.cursor] > 0 {
				id := ids[m.cursor]
				return m, func() tea.Msg { return NavigateMsg{View: ViewPlayer, PlayerID: id} }
			}
		case "right", "l":
			y, _ := strconvAtoi(m.season)
			m.season = fmt.Sprintf("%d", y+1)
			m.loading = true
			m.winners = nil
			m.cursor = 0
			return m, m.fetch()
		case "left", "h":
			y, _ := strconvAtoi(m.season)
			m.season = fmt.Sprintf("%d", y-1)
			m.loading = true
			m.winners = nil
			m.cursor = 0
			return m, m.fetch()
		case "r":
			m.loading = true
			return m, m.fetch()
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

func strconvAtoi(s string) (int, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("invalid")
		}
		n = n*10 + int(c-'0')
	}
	return n, nil
}

// awardBlock renders one league's winners. sel is the index within ws to
// highlight (the global cursor mapped into this block), or -1 for none.
func awardBlock(league string, ws []mlb.AwardWinner, w, sel int) string {
	var b strings.Builder
	b.WriteString(StyleDim.Render(league))
	if len(ws) == 0 {
		b.WriteString("\n" + StyleDim.Render("—"))
		return lipgloss.NewStyle().Width(w).Render(b.String())
	}
	single := len(ws) == 1
	for i, win := range ws {
		name := win.Player.NameFirstLast
		pos := win.Player.PrimaryPosition.Abbreviation
		nameStr := StyleHeader.Render(truncate(name, w-5))
		if single {
			nameStr = StyleAccent.Bold(true).Render(truncate(name, w-5))
		}
		if i == sel {
			nameStr = StyleItemSelected.Render("▸ " + truncate(name, w-5))
		}
		posStr := ""
		if pos != "" {
			posStr = " " + lipgloss.NewStyle().Foreground(positionColor(pos)).Render(pos)
		}
		b.WriteString("\n" + nameStr + posStr)
	}
	return lipgloss.NewStyle().Width(w).Render(b.String())
}

// indentBlock splits a (multi-line) block and prefixes every line.
func indentBlock(s, prefix string) []string {
	parts := strings.Split(s, "\n")
	for i := range parts {
		parts[i] = prefix + parts[i]
	}
	return parts
}

func (m AwardsModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}

	panelHdr := PanelHeader("AWARDS  "+m.season, m.width)

	if m.loading {
		return panelHdr + "\n\n" + loadingView("Loading awards…")
	}

	colW := 30
	if m.width > 0 {
		colW = (m.width - 8) / 2
		if colW < 20 {
			colW = 20
		}
		if colW > 40 {
			colW = 40
		}
	}

	var lines []string
	ts, te := headerColors()

	cursorLine := 0
	idx := 0 // running winner index, must match playerIDs() order
	for _, p := range awardPairs {
		al, nl := m.winners[p.al], m.winners[p.nl]
		if len(al) == 0 && len(nl) == 0 {
			continue
		}
		alSel, nlSel := -1, -1
		if m.cursor >= idx && m.cursor < idx+len(al) {
			alSel = m.cursor - idx
		}
		if m.cursor >= idx+len(al) && m.cursor < idx+len(al)+len(nl) {
			nlSel = m.cursor - idx - len(al)
		}
		lines = append(lines, "  "+p.icon+" "+gradientText(p.title, ts, te))
		blockStart := len(lines)
		block := lipgloss.JoinHorizontal(lipgloss.Top,
			awardBlock("AL", al, colW, alSel), "  ", awardBlock("NL", nl, colW, nlSel))
		lines = append(lines, indentBlock(block, "  ")...)
		// Capture cursorLine if this pair contains the selected winner.
		if m.cursor >= idx && m.cursor < idx+len(al)+len(nl) {
			var r int
			if m.cursor < idx+len(al) {
				r = m.cursor - idx
			} else {
				r = m.cursor - idx - len(al)
			}
			cursorLine = blockStart + 1 + r
		}
		idx += len(al) + len(nl)
		lines = append(lines, "")
	}

	var singleLines []string
	for _, s := range awardSingles {
		ws := m.winners[s.id]
		if len(ws) == 0 {
			continue
		}
		w := ws[0]
		sel := m.cursor == idx
		if sel {
			// +1 for the POSTSEASON header, +len(singleLines) for position within singles
			cursorLine = len(lines) + 1 + len(singleLines)
		}
		idx++
		pos := w.Player.PrimaryPosition.Abbreviation
		posStr := ""
		if pos != "" {
			posStr = "  " + lipgloss.NewStyle().Foreground(positionColor(pos)).Render(pos)
		}
		nameStr := StyleAccent.Bold(true).Render(w.Player.NameFirstLast)
		if sel {
			nameStr = StyleItemSelected.Render("▸ " + w.Player.NameFirstLast)
		}
		singleLines = append(singleLines, fmt.Sprintf("  %s %-18s %s%s",
			s.icon, StyleDim.Render(s.title), nameStr, posStr))
	}
	if len(singleLines) > 0 {
		lines = append(lines, "  "+gradientText("POSTSEASON", ts, te))
		lines = append(lines, singleLines...)
		lines = append(lines, "")
	}

	if len(lines) == 0 {
		lines = append(lines, StyleDim.Render("  No awards data for "+m.season+"."))
	}

	maxLines := 30
	start := cursorLine - maxLines/2
	if start < 0 {
		start = 0
	}
	if start > len(lines)-maxLines {
		start = len(lines) - maxLines
	}
	if start < 0 {
		start = 0
	}
	end := start + maxLines
	if end > len(lines) {
		end = len(lines)
	}
	visible := lines[start:end]

	body := strings.Join(visible, "\n")
	return panelHdr + "\n\n" + body + "\n\n" +
		HelpBar("◄/► year", "↑/↓ select", "Enter player", "r refresh", "esc back")
}
